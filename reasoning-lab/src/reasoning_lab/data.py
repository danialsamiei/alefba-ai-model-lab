from __future__ import annotations

import hashlib
import json
import os
import random
import re
import uuid
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Any, Final, Literal, TypeAlias

from reasoning_lab.config import DataConfig
from reasoning_lab.paths import GENERATED_DATA_ROOT, MANIFEST_ROOT
from reasoning_lab.task import (
    VARIABLES,
    Expr,
    TraceStep,
    evaluate_with_trace,
    generate_expression,
    render_expression,
    validate_bindings,
    variables_in,
)
from reasoning_lab.tokenizer import (
    BOS_TOKEN,
    CALL_TOKEN,
    EOS_TOKEN,
    EOT_TOKEN,
    FINAL_TOKEN,
    OBS_TOKEN,
    PROMPT_TOKEN,
    SCRATCH_TOKEN,
    FixedTokenizer,
    get_tokenizer,
)

if TYPE_CHECKING:
    from reasoning_lab.db import LabRepository


Split: TypeAlias = Literal["train", "validation", "iid_test", "depth_ood", "rag_holdout"]
Objective: TypeAlias = Literal["direct", "scratch", "tool"]

SPLITS: Final[tuple[Split, ...]] = (
    "train",
    "validation",
    "iid_test",
    "depth_ood",
    "rag_holdout",
)
OBJECTIVES: Final[tuple[Objective, ...]] = ("direct", "scratch", "tool")
DATASET_FORMAT: Final = "reasoning-lab-curriculum-v1"
DATASET_MANIFEST_SCHEMA: Final = "reasoning-lab-dataset-manifest-v2"
DATASET_GENERATOR_NAME: Final = "reasoning_lab.data.generate_curriculum"
DATASET_GENERATOR_VERSION: Final = "1.0.0"
DATASET_GENERATOR_SCHEMA: Final = "reasoning-lab-curriculum-generator-v1"
DATASET_LICENSE: Final = "CC-BY-4.0"
DATASET_LICENSE_SCOPE: Final = "generated synthetic dataset records and manifest"
DATASET_INTENDED_USE: Final[tuple[str, ...]] = (
    "educational inspection of a closed modulo-10 reasoning pipeline",
    "deterministic unit, integration, retrieval, and tool-use experiments",
    "micro-scale comparison of training and inference techniques",
)
DATASET_NOT_INTENDED_USE: Final[tuple[str, ...]] = (
    "benchmarking general-purpose language-model capability",
    "production, safety-critical, legal, medical, financial, or policy decisions",
    "claims about real-world factual knowledge, people, or populations",
)


def _canonical_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _stable_id(prefix: str, value: object) -> str:
    return f"{prefix}_{_sha256_text(_canonical_json(value))[:24]}"


def _validate_split(split: str) -> None:
    if split not in SPLITS:
        raise ValueError(f"UNKNOWN_DATA_SPLIT: {split}")


@dataclass(frozen=True, slots=True)
class World:
    world_id: str
    split: Split
    facts: Mapping[str, int]
    metadata: Mapping[str, Any]

    def __post_init__(self) -> None:
        if not self.world_id:
            raise ValueError("WORLD_ID_MUST_NOT_BE_EMPTY")
        _validate_split(self.split)
        normalized = validate_bindings(self.facts)
        if tuple(sorted(normalized)) != VARIABLES:
            raise ValueError("WORLD_MUST_BIND_EACH_VARIABLE_A_THROUGH_H")
        object.__setattr__(self, "facts", normalized)
        object.__setattr__(self, "metadata", dict(self.metadata))

    def prompt_text(self, variables: Sequence[str] = VARIABLES) -> str:
        selected = tuple(variables)
        if not selected or any(name not in VARIABLES for name in selected):
            raise ValueError("WORLD_PROMPT_VARIABLES_MUST_BE_A_NON_EMPTY_SUBSET_OF_A_TO_H")
        assignments = ",".join(f"{name}={self.facts[name]}" for name in selected)
        return f"WORLD({assignments})"

    def to_record(self) -> dict[str, object]:
        return {
            "world_id": self.world_id,
            "split": self.split,
            "facts": {name: self.facts[name] for name in VARIABLES},
            "metadata": dict(self.metadata),
        }

    def to_sqlite_row(self, dataset_version_id: str) -> dict[str, object]:
        return {
            "world_id": self.world_id,
            "dataset_version_id": dataset_version_id,
            "split": self.split,
            "facts": dict(self.facts),
        }


@dataclass(frozen=True, slots=True)
class Document:
    document_id: str
    world_id: str
    split: Split
    variable: str
    value: int
    content: str
    source_uri: str
    metadata: Mapping[str, Any]

    def __post_init__(self) -> None:
        if not self.document_id or not self.world_id:
            raise ValueError("DOCUMENT_AND_WORLD_IDS_MUST_NOT_BE_EMPTY")
        _validate_split(self.split)
        if self.variable not in VARIABLES:
            raise ValueError(f"INVALID_DOCUMENT_VARIABLE: {self.variable!r}")
        if isinstance(self.value, bool) or not isinstance(self.value, int):
            raise TypeError("DOCUMENT_VALUE_MUST_BE_AN_INTEGER")
        if not 0 <= self.value <= 9:
            raise ValueError("DOCUMENT_VALUE_OUTSIDE_ZERO_TO_NINE")
        if not self.content or not self.source_uri:
            raise ValueError("DOCUMENT_CONTENT_AND_SOURCE_MUST_NOT_BE_EMPTY")
        object.__setattr__(self, "metadata", dict(self.metadata))

    @property
    def content_sha256(self) -> str:
        return _sha256_text(self.content)

    def to_record(self) -> dict[str, object]:
        return {
            "document_id": self.document_id,
            "world_id": self.world_id,
            "split": self.split,
            "variable": self.variable,
            "value": self.value,
            "content": self.content,
            "content_sha256": self.content_sha256,
            "source_uri": self.source_uri,
            "metadata": dict(self.metadata),
        }

    def to_sqlite_row(self) -> dict[str, object]:
        return {
            "document_id": self.document_id,
            "world_id": self.world_id,
            "variable": self.variable,
            "value": self.value,
            "content": self.content,
            "source_uri": self.source_uri,
            "metadata": dict(self.metadata),
        }


@dataclass(frozen=True, slots=True)
class Episode:
    episode_id: str
    world_id: str
    split: Split
    expression: str
    expression_depth: int
    prompt_text: str
    gold_answer: int
    canonical_trace: tuple[str, ...]
    metadata: Mapping[str, Any]

    def __post_init__(self) -> None:
        if not self.episode_id or not self.world_id:
            raise ValueError("EPISODE_AND_WORLD_IDS_MUST_NOT_BE_EMPTY")
        _validate_split(self.split)
        if self.expression_depth < 0:
            raise ValueError("EXPRESSION_DEPTH_MUST_BE_NON_NEGATIVE")
        if not 0 <= self.gold_answer <= 9:
            raise ValueError("GOLD_ANSWER_OUTSIDE_ZERO_TO_NINE")
        if not self.canonical_trace:
            raise ValueError("CANONICAL_TRACE_MUST_NOT_BE_EMPTY")
        object.__setattr__(self, "canonical_trace", tuple(self.canonical_trace))
        object.__setattr__(self, "metadata", dict(self.metadata))

    def to_record(self) -> dict[str, object]:
        return {
            "episode_id": self.episode_id,
            "world_id": self.world_id,
            "split": self.split,
            "expression": self.expression,
            "expression_depth": self.expression_depth,
            "prompt_text": self.prompt_text,
            "gold_answer": self.gold_answer,
            "canonical_trace": list(self.canonical_trace),
            "metadata": dict(self.metadata),
        }

    def to_sqlite_row(self, dataset_version_id: str) -> dict[str, object]:
        return {
            "episode_id": self.episode_id,
            "dataset_version_id": dataset_version_id,
            "world_id": self.world_id,
            "split": self.split,
            "expression": self.expression,
            "expression_depth": self.expression_depth,
            "prompt_text": self.prompt_text,
            "gold_answer": self.gold_answer,
            "canonical_trace": list(self.canonical_trace),
            "metadata": dict(self.metadata),
        }


@dataclass(frozen=True, slots=True)
class TrainingExample:
    token_ids: tuple[int, ...]
    loss_mask: tuple[bool, ...]
    objective: Objective
    split: Split
    episode_id: str
    metadata: Mapping[str, Any]

    def __post_init__(self) -> None:
        if len(self.token_ids) != len(self.loss_mask):
            raise ValueError("TOKEN_IDS_AND_LOSS_MASK_MUST_HAVE_EQUAL_LENGTH")
        if not self.token_ids:
            raise ValueError("TRAINING_EXAMPLE_MUST_NOT_BE_EMPTY")
        if any(
            isinstance(token_id, bool) or not isinstance(token_id, int)
            for token_id in self.token_ids
        ):
            raise TypeError("TRAINING_EXAMPLE_TOKEN_IDS_MUST_BE_INTEGERS")
        if any(token_id < 0 for token_id in self.token_ids):
            raise ValueError("TRAINING_EXAMPLE_TOKEN_ID_MUST_BE_NON_NEGATIVE")
        if any(type(selected) is not bool for selected in self.loss_mask):
            raise TypeError("TRAINING_EXAMPLE_LOSS_MASK_MUST_CONTAIN_BOOLEANS")
        if not any(self.loss_mask):
            raise ValueError("TRAINING_EXAMPLE_REQUIRES_AT_LEAST_ONE_LOSS_TOKEN")
        if self.objective not in OBJECTIVES:
            raise ValueError(f"UNKNOWN_TRAINING_OBJECTIVE: {self.objective}")
        _validate_split(self.split)
        if not self.episode_id:
            raise ValueError("TRAINING_EXAMPLE_EPISODE_ID_MUST_NOT_BE_EMPTY")
        object.__setattr__(self, "token_ids", tuple(self.token_ids))
        object.__setattr__(self, "loss_mask", tuple(self.loss_mask))
        object.__setattr__(self, "metadata", dict(self.metadata))

    @property
    def example_id(self) -> str:
        return _stable_id(
            "example",
            {"episode_id": self.episode_id, "objective": self.objective},
        )

    def to_record(self) -> dict[str, object]:
        return {
            "example_id": self.example_id,
            "episode_id": self.episode_id,
            "split": self.split,
            "objective": self.objective,
            "token_ids": list(self.token_ids),
            "loss_mask": list(self.loss_mask),
            "metadata": dict(self.metadata),
        }

    def to_sqlite_row(self) -> dict[str, object]:
        return {
            "example_id": self.example_id,
            "episode_id": self.episode_id,
            "objective": self.objective,
            "token_ids": list(self.token_ids),
            "loss_mask": list(self.loss_mask),
            "metadata": dict(self.metadata),
        }


@dataclass(frozen=True, slots=True)
class Curriculum:
    seed: int
    worlds: tuple[World, ...]
    documents: tuple[Document, ...]
    episodes: tuple[Episode, ...]
    examples: tuple[TrainingExample, ...]
    tokenizer_sha256: str
    generation_config: Mapping[str, object] = field(default_factory=dict)

    def worlds_for(self, split: Split) -> tuple[World, ...]:
        _validate_split(split)
        return tuple(world for world in self.worlds if world.split == split)

    def documents_for(self, split: Split) -> tuple[Document, ...]:
        _validate_split(split)
        return tuple(document for document in self.documents if document.split == split)

    def episodes_for(self, split: Split) -> tuple[Episode, ...]:
        _validate_split(split)
        return tuple(episode for episode in self.episodes if episode.split == split)

    def examples_for(
        self,
        split: Split,
        objective: Objective | None = None,
    ) -> tuple[TrainingExample, ...]:
        _validate_split(split)
        if objective is not None and objective not in OBJECTIVES:
            raise ValueError(f"UNKNOWN_TRAINING_OBJECTIVE: {objective}")
        return tuple(
            example
            for example in self.examples
            if example.split == split and (objective is None or example.objective == objective)
        )

    def counts_by_split(self) -> dict[str, int]:
        return {split: len(self.episodes_for(split)) for split in SPLITS}

    @property
    def dataset_sha256(self) -> str:
        payload = {
            "format": DATASET_FORMAT,
            "seed": self.seed,
            "tokenizer_sha256": self.tokenizer_sha256,
            "worlds": [world.to_record() for world in self.worlds],
            "documents": [document.to_record() for document in self.documents],
            "episodes": [episode.to_record() for episode in self.episodes],
            "examples": [example.to_record() for example in self.examples],
        }
        return _sha256_text(_canonical_json(payload))


Dataset = Curriculum


@dataclass(frozen=True, slots=True)
class JsonlDigest:
    filename: str
    sha256: str
    records: int
    size_bytes: int

    def to_record(self) -> dict[str, object]:
        return {
            "filename": self.filename,
            "sha256": self.sha256,
            "records": self.records,
            "size_bytes": self.size_bytes,
        }


@dataclass(frozen=True, slots=True)
class DatasetManifest:
    dataset_sha256: str
    manifest_sha256: str
    seed: int
    tokenizer_sha256: str
    split_counts: Mapping[str, int]
    files: tuple[JsonlDigest, ...]
    generation_config: Mapping[str, object] = field(default_factory=dict)

    @property
    def manifest_schema(self) -> str:
        return DATASET_MANIFEST_SCHEMA

    @property
    def synthetic(self) -> bool:
        return True

    @property
    def license(self) -> str:
        return DATASET_LICENSE

    @property
    def generator(self) -> Mapping[str, str]:
        return {
            "name": DATASET_GENERATOR_NAME,
            "version": DATASET_GENERATOR_VERSION,
            "schema": DATASET_GENERATOR_SCHEMA,
        }

    @property
    def provenance(self) -> Mapping[str, object]:
        return _manifest_provenance(
            seed=self.seed,
            tokenizer_sha256=self.tokenizer_sha256,
            split_counts=self.split_counts,
            generation_config=self.generation_config,
        )

    @property
    def intended_use(self) -> tuple[str, ...]:
        return DATASET_INTENDED_USE

    @property
    def not_intended_use(self) -> tuple[str, ...]:
        return DATASET_NOT_INTENDED_USE

    def to_record(self, *, include_manifest_sha256: bool = True) -> dict[str, object]:
        record: dict[str, object] = {
            "format": DATASET_FORMAT,
            "manifest_schema": self.manifest_schema,
            "synthetic": self.synthetic,
            "license": self.license,
            "license_scope": DATASET_LICENSE_SCOPE,
            "generator": dict(self.generator),
            "provenance": dict(self.provenance),
            "intended_use": list(self.intended_use),
            "not_intended_use": list(self.not_intended_use),
            "dataset_sha256": self.dataset_sha256,
            "seed": self.seed,
            "tokenizer_sha256": self.tokenizer_sha256,
            "split_counts": dict(self.split_counts),
            "files": [entry.to_record() for entry in self.files],
        }
        if include_manifest_sha256:
            record["manifest_sha256"] = self.manifest_sha256
        return record


def _manifest_provenance(
    *,
    seed: int,
    tokenizer_sha256: str,
    split_counts: Mapping[str, int],
    generation_config: Mapping[str, object],
) -> dict[str, object]:
    """Describe only deterministic local inputs; no external corpus is implied."""

    generation_parameters = dict(generation_config)
    generation_parameters["split_counts"] = dict(split_counts)
    generation_parameters["tokenizer_sha256"] = tokenizer_sha256
    return {
        "origin": "deterministic_programmatic_generation",
        "inputs": {
            "external_corpora": [],
            "external_model_outputs": [],
            "personal_or_user_data": False,
            "task_grammar": {
                "operators": ["ADD", "SUB", "MUL"],
                "variables": list(VARIABLES),
                "value_domain": "integers modulo 10",
            },
            "generation_parameters": generation_parameters,
        },
        "seed": {
            "master": seed,
            "scope": "all generated entities and examples",
            "split_derivation": (
                "first 8 bytes of sha256('{master_seed}:{split}') interpreted as an "
                "unsigned big-endian integer"
            ),
            "random_source": "one python random.Random instance per split",
        },
    }


def _split_seed(seed: int, split: Split) -> int:
    digest = hashlib.sha256(f"{seed}:{split}".encode("ascii")).digest()
    return int.from_bytes(digest[:8], "big", signed=False)


def _new_world(
    rng: random.Random,
    *,
    split: Split,
    ordinal: int,
    used_facts: set[tuple[int, ...]],
) -> World:
    for _ in range(100_000):
        values = tuple(rng.randrange(10) for _ in VARIABLES)
        if values in used_facts:
            continue
        used_facts.add(values)
        facts = dict(zip(VARIABLES, values, strict=True))
        return World(
            world_id=_stable_id("world", facts),
            split=split,
            facts=facts,
            metadata={"ordinal": ordinal},
        )
    raise RuntimeError("UNABLE_TO_GENERATE_A_UNIQUE_WORLD")


def _episode_prompt(
    world: World,
    expression: str,
    split: Split,
    documents: Sequence[Document],
) -> str:
    if split == "rag_holdout":
        return f"QUERY={expression}"
    prompt_variables = tuple(document.variable for document in documents)
    return f"{world.prompt_text(prompt_variables)};QUERY={expression}"


def _make_episode(
    *,
    world: World,
    expression: Expr,
    split: Split,
    ordinal: int,
    documents: Sequence[Document],
) -> tuple[Episode, tuple[TraceStep, ...]]:
    rendered = render_expression(expression)
    result = evaluate_with_trace(expression, world.facts)
    prompt = _episode_prompt(world, rendered, split, documents)
    episode_payload = {
        "world_id": world.world_id,
        "expression": rendered,
        "prompt_text": prompt,
        "gold_answer": result.value,
    }
    episode = Episode(
        episode_id=_stable_id("episode", episode_payload),
        world_id=world.world_id,
        split=split,
        expression=rendered,
        expression_depth=expression.depth,
        prompt_text=prompt,
        gold_answer=result.value,
        canonical_trace=tuple(step.render() for step in result.trace),
        metadata={
            "ordinal": ordinal,
            "requires_retrieval": split == "rag_holdout",
            "variables": list(variables_in(expression)),
            "document_ids": [document.document_id for document in documents],
            "distractor_count": sum(
                bool(document.metadata.get("distractor")) for document in documents
            ),
        },
    )
    return episode, result.trace


def _make_documents(
    *,
    world: World,
    expression: Expr,
    rng: random.Random,
    max_distractors: int,
) -> tuple[Document, ...]:
    relevant = set(variables_in(expression))
    unused = [variable for variable in VARIABLES if variable not in relevant]
    distractor_count = min(len(unused), rng.randrange(max_distractors + 1))
    distractors = set(rng.sample(unused, distractor_count))
    selected = relevant | distractors
    documents: list[Document] = []
    for variable in VARIABLES:
        if variable not in selected:
            continue
        value = world.facts[variable]
        document_id = _stable_id("document", {"world_id": world.world_id, "variable": variable})
        documents.append(
            Document(
                document_id=document_id,
                world_id=world.world_id,
                split=world.split,
                variable=variable,
                value=value,
                content=f"Fact {variable}: variable {variable} has value {value}.",
                source_uri=f"microworld://{world.world_id}/{variable}",
                metadata={
                    "relevant": variable in relevant,
                    "distractor": variable in distractors,
                },
            )
        )
    return tuple(documents)


@dataclass(frozen=True, slots=True)
class _Segment:
    kind: str
    marker: str
    payload: str
    learn_payload: bool


def _encode_segments(
    *,
    tokenizer: FixedTokenizer,
    episode: Episode,
    objective: Objective,
    segments: Sequence[_Segment],
) -> TrainingExample:
    token_ids: list[int] = [tokenizer.token_id(BOS_TOKEN)]
    loss_mask: list[bool] = [False]
    segment_metadata: list[dict[str, object]] = []
    for segment in segments:
        marker_index = len(token_ids)
        token_ids.append(tokenizer.token_id(segment.marker))
        loss_mask.append(False)
        payload_start = len(token_ids)
        payload_ids = tokenizer.encode(segment.payload)
        token_ids.extend(payload_ids)
        loss_mask.extend([segment.learn_payload] * len(payload_ids))
        payload_end = len(token_ids)
        terminator_index = len(token_ids)
        token_ids.append(tokenizer.token_id(EOT_TOKEN))
        loss_mask.append(False)
        segment_metadata.append(
            {
                "kind": segment.kind,
                "marker_index": marker_index,
                "payload_start": payload_start,
                "payload_end": payload_end,
                "terminator_index": terminator_index,
                "loss": segment.learn_payload,
            }
        )
    token_ids.append(tokenizer.token_id(EOS_TOKEN))
    loss_mask.append(False)
    return TrainingExample(
        token_ids=tuple(token_ids),
        loss_mask=tuple(loss_mask),
        objective=objective,
        split=episode.split,
        episode_id=episode.episode_id,
        metadata={
            "world_id": episode.world_id,
            "expression": episode.expression,
            "expression_depth": episode.expression_depth,
            "gold_answer": episode.gold_answer,
            "segments": segment_metadata,
            "transcript": objective == "tool",
        },
    )


def build_training_example(
    episode: Episode,
    objective: Objective | Literal["interactive"],
    *,
    tokenizer: FixedTokenizer | None = None,
    max_sequence_length: int | None = None,
) -> TrainingExample:
    """Build one objective while keeping role boundaries explicit in metadata."""

    active_tokenizer = tokenizer or get_tokenizer()
    canonical_objective: Objective = "tool" if objective == "interactive" else objective
    if canonical_objective not in OBJECTIVES:
        raise ValueError(f"UNKNOWN_TRAINING_OBJECTIVE: {objective}")
    prompt = _Segment("PROMPT", PROMPT_TOKEN, episode.prompt_text, False)
    answer = str(episode.gold_answer)
    segments: tuple[_Segment, ...]
    if canonical_objective == "direct":
        segments = (prompt, _Segment("FINAL", FINAL_TOKEN, answer, True))
    elif canonical_objective == "scratch":
        scratch = f"TRACE({';'.join(episode.canonical_trace)});RESULT={answer}"
        segments = (
            prompt,
            _Segment("SCRATCH", SCRATCH_TOKEN, scratch, True),
            _Segment("FINAL", FINAL_TOKEN, answer, True),
        )
    else:
        interactive: list[_Segment] = [prompt]
        for trace_line in episode.canonical_trace:
            parts = trace_line.split()
            if parts[0] == "GET":
                call = f"LOOKUP {parts[1]}"
                observation = parts[2]
            else:
                call = f"CALC {parts[0]} {parts[1]} {parts[2]}"
                observation = parts[3]
            interactive.append(_Segment("CALL", CALL_TOKEN, call, True))
            interactive.append(_Segment("OBS", OBS_TOKEN, observation, False))
        interactive.append(_Segment("FINAL", FINAL_TOKEN, answer, True))
        segments = tuple(interactive)
    example = _encode_segments(
        tokenizer=active_tokenizer,
        episode=episode,
        objective=canonical_objective,
        segments=segments,
    )
    if max_sequence_length is not None:
        if max_sequence_length <= 0:
            raise ValueError("MAX_SEQUENCE_LENGTH_MUST_BE_POSITIVE")
        if len(example.token_ids) > max_sequence_length:
            raise ValueError(
                "SEQUENCE_LENGTH_EXCEEDS_LIMIT: "
                f"{episode.episode_id}:{canonical_objective}:"
                f"{len(example.token_ids)}>{max_sequence_length}"
            )
    return example


def build_training_examples(
    episode: Episode,
    *,
    tokenizer: FixedTokenizer | None = None,
    max_sequence_length: int | None = None,
) -> tuple[TrainingExample, ...]:
    active_tokenizer = tokenizer or get_tokenizer()
    return tuple(
        build_training_example(
            episode,
            objective,
            tokenizer=active_tokenizer,
            max_sequence_length=max_sequence_length,
        )
        for objective in OBJECTIVES
    )


def _canonical_objective_name(
    objective: Objective | Literal["interactive"],
) -> Objective:
    canonical: Objective = "tool" if objective == "interactive" else objective
    if canonical not in OBJECTIVES:
        raise ValueError(f"UNKNOWN_TRAINING_OBJECTIVE: {objective}")
    return canonical


def build_inference_prompt(
    episode: Episode,
    objective: Objective | Literal["interactive"],
) -> str:
    """Build the stable prefix that the model continues for an objective.

    The output role marker is part of the supplied prefix because structural
    markers are deliberately excluded from the supervised loss mask.
    """

    canonical = _canonical_objective_name(objective)
    output_marker = {
        "direct": FINAL_TOKEN,
        "scratch": SCRATCH_TOKEN,
        "tool": CALL_TOKEN,
    }[canonical]
    return f"{BOS_TOKEN}{PROMPT_TOKEN}{episode.prompt_text}{EOT_TOKEN}{output_marker}"


def build_inference_token_ids(
    episode: Episode,
    objective: Objective | Literal["interactive"],
    *,
    tokenizer: FixedTokenizer | None = None,
) -> tuple[int, ...]:
    active_tokenizer = tokenizer or get_tokenizer()
    return active_tokenizer.encode(build_inference_prompt(episode, objective))


_TRACE_GET_RE = re.compile(r"GET ([A-H]) ([0-9])\Z")
_TRACE_OP_RE = re.compile(r"(ADD|SUB|MUL) ([0-9]) ([0-9]) ([0-9])\Z")
_TOOL_TURN_RE = re.compile(
    r"<CALL>(?:LOOKUP ([A-H])|CALC (ADD|SUB|MUL) ([0-9]) ([0-9]))"
    r"<EOT><OBS>([0-9])<EOT>"
)


def _validate_trace_line(line: str) -> None:
    if _TRACE_GET_RE.fullmatch(line) is not None:
        return
    match = _TRACE_OP_RE.fullmatch(line)
    if match is None:
        raise ValueError(f"INVALID_CANONICAL_TRACE_LINE: {line!r}")
    operator, left_text, right_text, result_text = match.groups()
    left, right, result = int(left_text), int(right_text), int(result_text)
    if operator == "ADD":
        expected = (left + right) % 10
    elif operator == "SUB":
        expected = (left - right) % 10
    else:
        expected = (left * right) % 10
    if result != expected:
        raise ValueError(f"INVALID_CANONICAL_TRACE_ARITHMETIC: {line!r}")


def parse_final_answer(text: str) -> int:
    """Strictly parse the single modulo-10 answer from a FINAL segment."""

    if not isinstance(text, str):
        raise TypeError("MODEL_OUTPUT_MUST_BE_TEXT")
    marker = text.rfind(FINAL_TOKEN)
    if marker < 0:
        raise ValueError("MODEL_OUTPUT_MISSING_FINAL_SEGMENT")
    payload = text[marker + len(FINAL_TOKEN) :]
    for terminator in (EOT_TOKEN, EOS_TOKEN):
        if terminator in payload:
            payload = payload.split(terminator, 1)[0]
    payload = payload.strip()
    if re.fullmatch(r"[0-9]", payload) is None:
        raise ValueError(f"FINAL_ANSWER_MUST_BE_ONE_DIGIT: {payload!r}")
    return int(payload)


def parse_canonical_trace(text: str) -> tuple[str, ...]:
    """Parse and validate either a scratch trace or an interactive tool trace."""

    if not isinstance(text, str):
        raise TypeError("MODEL_OUTPUT_MUST_BE_TEXT")
    trace_start = text.find("TRACE(")
    if trace_start >= 0:
        trace_start += len("TRACE(")
        trace_end = text.find(");RESULT=", trace_start)
        if trace_end < 0:
            raise ValueError("SCRATCH_OUTPUT_HAS_UNTERMINATED_TRACE")
        payload = text[trace_start:trace_end]
        scratch_lines = tuple(payload.split(";")) if payload else ()
        if not scratch_lines:
            raise ValueError("SCRATCH_OUTPUT_TRACE_MUST_NOT_BE_EMPTY")
        for line in scratch_lines:
            _validate_trace_line(line)
        return scratch_lines

    tool_lines: list[str] = []
    for match in _TOOL_TURN_RE.finditer(text):
        variable, operator, left, right, observation = match.groups()
        if variable is not None:
            line = f"GET {variable} {observation}"
        else:
            assert operator is not None and left is not None and right is not None
            line = f"{operator} {left} {right} {observation}"
        _validate_trace_line(line)
        tool_lines.append(line)
    return tuple(tool_lines)


parse_trace = parse_canonical_trace


@dataclass(frozen=True, slots=True)
class ParsedModelOutput:
    final_answer: int
    canonical_trace: tuple[str, ...]


def parse_model_output(text: str) -> ParsedModelOutput:
    return ParsedModelOutput(
        final_answer=parse_final_answer(text),
        canonical_trace=parse_canonical_trace(text),
    )


def _episode_count(config: DataConfig, split: Split) -> int:
    return {
        "train": config.train_episodes,
        "validation": config.validation_episodes,
        "iid_test": config.iid_test_episodes,
        "depth_ood": config.depth_ood_episodes,
        "rag_holdout": config.rag_holdout_episodes,
    }[split]


def generate_curriculum(
    config: DataConfig,
    *,
    tokenizer: FixedTokenizer | None = None,
    max_sequence_length: int = 160,
) -> Curriculum:
    """Generate all five splits deterministically from ``DataConfig`` only."""

    active_tokenizer = tokenizer or get_tokenizer()
    worlds: list[World] = []
    documents: list[Document] = []
    episodes: list[Episode] = []
    examples: list[TrainingExample] = []
    used_facts: set[tuple[int, ...]] = set()

    for split in SPLITS:
        rng = random.Random(_split_seed(config.seed, split))
        count = _episode_count(config, split)
        for ordinal in range(count):
            world = _new_world(
                rng,
                split=split,
                ordinal=ordinal,
                used_facts=used_facts,
            )
            target_depth = (
                config.ood_depth if split == "depth_ood" else ordinal % (config.train_max_depth + 1)
            )
            expression = generate_expression(rng, target_depth)
            episode_documents = _make_documents(
                world=world,
                expression=expression,
                rng=rng,
                max_distractors=config.max_distractors,
            )
            episode, _ = _make_episode(
                world=world,
                expression=expression,
                split=split,
                ordinal=ordinal,
                documents=episode_documents,
            )
            worlds.append(world)
            documents.extend(episode_documents)
            episodes.append(episode)
            examples.extend(
                build_training_examples(
                    episode,
                    tokenizer=active_tokenizer,
                    max_sequence_length=max_sequence_length,
                )
            )

    curriculum = Curriculum(
        seed=config.seed,
        worlds=tuple(worlds),
        documents=tuple(documents),
        episodes=tuple(episodes),
        examples=tuple(examples),
        tokenizer_sha256=active_tokenizer.vocabulary_sha256,
        generation_config=config.to_dict(),
    )
    assert_no_split_leakage(curriculum)
    return curriculum


generate_dataset = generate_curriculum


def find_split_leakage(curriculum: Curriculum) -> tuple[str, ...]:
    """Return deterministic diagnostics for identity or content crossing splits."""

    violations: list[str] = []
    world_by_id: dict[str, World] = {}
    fact_owner: dict[str, Split] = {}
    for world in curriculum.worlds:
        existing = world_by_id.get(world.world_id)
        if existing is not None:
            violations.append(f"DUPLICATE_WORLD_ID:{world.world_id}")
            if existing.split != world.split:
                violations.append(f"WORLD_ID_CROSSES_SPLITS:{world.world_id}")
        world_by_id[world.world_id] = world
        fingerprint = _sha256_text(_canonical_json(dict(world.facts)))
        fact_split = fact_owner.setdefault(fingerprint, world.split)
        if fact_split != world.split:
            violations.append(f"WORLD_FACTS_CROSS_SPLITS:{fingerprint}")

    document_ids: dict[str, Split] = {}
    for document in curriculum.documents:
        document_split = document_ids.setdefault(document.document_id, document.split)
        if document_split != document.split:
            violations.append(f"DOCUMENT_ID_CROSSES_SPLITS:{document.document_id}")
        document_world = world_by_id.get(document.world_id)
        if document_world is None:
            violations.append(f"DOCUMENT_HAS_UNKNOWN_WORLD:{document.document_id}")
        elif document_world.split != document.split:
            violations.append(f"DOCUMENT_SPLIT_MISMATCH:{document.document_id}")

    episode_by_id: dict[str, Episode] = {}
    task_owner: dict[str, Split] = {}
    for episode in curriculum.episodes:
        existing_episode = episode_by_id.get(episode.episode_id)
        if existing_episode is not None:
            violations.append(f"DUPLICATE_EPISODE_ID:{episode.episode_id}")
            if existing_episode.split != episode.split:
                violations.append(f"EPISODE_ID_CROSSES_SPLITS:{episode.episode_id}")
        episode_by_id[episode.episode_id] = episode
        episode_world = world_by_id.get(episode.world_id)
        if episode_world is None:
            violations.append(f"EPISODE_HAS_UNKNOWN_WORLD:{episode.episode_id}")
            continue
        if episode_world.split != episode.split:
            violations.append(f"EPISODE_SPLIT_MISMATCH:{episode.episode_id}")
        task_fingerprint = _sha256_text(
            _canonical_json({"facts": dict(episode_world.facts), "expression": episode.expression})
        )
        task_split = task_owner.setdefault(task_fingerprint, episode.split)
        if task_split != episode.split:
            violations.append(f"EPISODE_CONTENT_CROSSES_SPLITS:{task_fingerprint}")

    objective_keys: set[tuple[str, str]] = set()
    for example in curriculum.examples:
        example_episode = episode_by_id.get(example.episode_id)
        if example_episode is None:
            violations.append(f"EXAMPLE_HAS_UNKNOWN_EPISODE:{example.example_id}")
            continue
        if example_episode.split != example.split:
            violations.append(f"EXAMPLE_SPLIT_MISMATCH:{example.example_id}")
        key = (example.episode_id, example.objective)
        if key in objective_keys:
            violations.append(f"DUPLICATE_EPISODE_OBJECTIVE:{example.example_id}")
        objective_keys.add(key)

    return tuple(sorted(set(violations)))


def assert_no_split_leakage(curriculum: Curriculum) -> None:
    violations = find_split_leakage(curriculum)
    if violations:
        raise ValueError("SPLIT_LEAKAGE_DETECTED: " + ",".join(violations))


def _atomic_write(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    temporary.write_bytes(payload)
    os.replace(temporary, path)


def write_jsonl(
    path: Path | str,
    records: Iterable[Mapping[str, object]],
) -> JsonlDigest:
    """Write canonical UTF-8 JSONL and return the digest of the exact bytes."""

    target = Path(path)
    encoded_lines = [(_canonical_json(dict(record)) + "\n").encode("utf-8") for record in records]
    payload = b"".join(encoded_lines)
    _atomic_write(target, payload)
    return JsonlDigest(
        filename=target.name,
        sha256=hashlib.sha256(payload).hexdigest(),
        records=len(encoded_lines),
        size_bytes=len(payload),
    )


def write_curriculum_jsonl(
    curriculum: Curriculum,
    output_dir: Path | str,
    *,
    manifest_dir: Path | str | None = None,
) -> DatasetManifest:
    """Write normalized entity files, split example files, and SHA-256 manifests."""

    assert_no_split_leakage(curriculum)
    data_directory = Path(output_dir)
    manifests = Path(manifest_dir) if manifest_dir is not None else data_directory
    entries: list[JsonlDigest] = []
    entries.append(
        write_jsonl(
            data_directory / "worlds.jsonl", (item.to_record() for item in curriculum.worlds)
        )
    )
    entries.append(
        write_jsonl(
            data_directory / "documents.jsonl", (item.to_record() for item in curriculum.documents)
        )
    )
    entries.append(
        write_jsonl(
            data_directory / "episodes.jsonl", (item.to_record() for item in curriculum.episodes)
        )
    )
    for split in SPLITS:
        entries.append(
            write_jsonl(
                data_directory / f"{split}.jsonl",
                (item.to_record() for item in curriculum.examples_for(split)),
            )
        )

    manifest = DatasetManifest(
        dataset_sha256=curriculum.dataset_sha256,
        manifest_sha256="",
        seed=curriculum.seed,
        tokenizer_sha256=curriculum.tokenizer_sha256,
        split_counts=curriculum.counts_by_split(),
        files=tuple(entries),
        generation_config=curriculum.generation_config,
    )
    manifest_without_hash = manifest.to_record(include_manifest_sha256=False)
    manifest_payload = (
        json.dumps(
            manifest_without_hash,
            ensure_ascii=False,
            sort_keys=True,
            indent=2,
        )
        + "\n"
    ).encode("utf-8")
    manifest_sha256 = hashlib.sha256(manifest_payload).hexdigest()
    manifest_path = manifests / "dataset-manifest.json"
    _atomic_write(manifest_path, manifest_payload)
    _atomic_write(
        manifests / "dataset-manifest.sha256",
        f"{manifest_sha256}  {manifest_path.name}\n".encode("ascii"),
    )
    checksum_lines = [f"{entry.sha256}  {entry.filename}" for entry in entries]
    checksum_lines.append(f"{manifest_sha256}  {manifest_path.name}")
    _atomic_write(
        manifests / "SHA256SUMS",
        ("\n".join(checksum_lines) + "\n").encode("ascii"),
    )
    return DatasetManifest(
        dataset_sha256=curriculum.dataset_sha256,
        manifest_sha256=manifest_sha256,
        seed=curriculum.seed,
        tokenizer_sha256=curriculum.tokenizer_sha256,
        split_counts=curriculum.counts_by_split(),
        files=tuple(entries),
        generation_config=curriculum.generation_config,
    )


write_dataset = write_curriculum_jsonl


def generate_jsonl_dataset(
    config: DataConfig,
    output_dir: Path | str = GENERATED_DATA_ROOT,
    *,
    manifest_dir: Path | str = MANIFEST_ROOT,
    tokenizer: FixedTokenizer | None = None,
    max_sequence_length: int = 160,
) -> tuple[Curriculum, DatasetManifest]:
    curriculum = generate_curriculum(
        config,
        tokenizer=tokenizer,
        max_sequence_length=max_sequence_length,
    )
    manifest = write_curriculum_jsonl(
        curriculum,
        output_dir,
        manifest_dir=manifest_dir,
    )
    return curriculum, manifest


def persist_curriculum(
    repository: LabRepository,
    curriculum: Curriculum,
    *,
    manifest_path: Path | str | None = None,
) -> str:
    """Insert deterministic rows through the repository's guarded interface."""

    assert_no_split_leakage(curriculum)
    dataset_version_id = repository.register_dataset(
        dataset_hash=curriculum.dataset_sha256,
        config={
            "format": DATASET_FORMAT,
            "seed": curriculum.seed,
            "split_counts": curriculum.counts_by_split(),
            "tokenizer_sha256": curriculum.tokenizer_sha256,
        },
        manifest_path=None if manifest_path is None else str(Path(manifest_path)),
    )
    for world in curriculum.worlds:
        repository.put_world(
            world_id=world.world_id,
            dataset_version_id=dataset_version_id,
            split=world.split,
            facts=world.facts,
        )
    for document in curriculum.documents:
        repository.put_document(
            document_id=document.document_id,
            world_id=document.world_id,
            variable=document.variable,
            value=document.value,
            content=document.content,
            source_uri=document.source_uri,
            metadata=document.metadata,
        )
    for episode in curriculum.episodes:
        repository.put_episode(
            episode_id=episode.episode_id,
            dataset_version_id=dataset_version_id,
            world_id=episode.world_id,
            split=episode.split,
            expression=episode.expression,
            expression_depth=episode.expression_depth,
            prompt_text=episode.prompt_text,
            gold_answer=episode.gold_answer,
            canonical_trace=episode.canonical_trace,
            metadata=episode.metadata,
        )
    for example in curriculum.examples:
        repository.put_training_example(
            example_id=example.example_id,
            episode_id=example.episode_id,
            objective=example.objective,
            token_ids=example.token_ids,
            loss_mask=example.loss_mask,
            metadata=example.metadata,
        )
    return dataset_version_id


__all__ = [
    "DATASET_FORMAT",
    "DATASET_GENERATOR_NAME",
    "DATASET_GENERATOR_SCHEMA",
    "DATASET_GENERATOR_VERSION",
    "DATASET_INTENDED_USE",
    "DATASET_LICENSE",
    "DATASET_LICENSE_SCOPE",
    "DATASET_MANIFEST_SCHEMA",
    "DATASET_NOT_INTENDED_USE",
    "OBJECTIVES",
    "SPLITS",
    "Dataset",
    "DatasetManifest",
    "Document",
    "Episode",
    "JsonlDigest",
    "Objective",
    "ParsedModelOutput",
    "Split",
    "TrainingExample",
    "World",
    "assert_no_split_leakage",
    "build_inference_prompt",
    "build_inference_token_ids",
    "build_training_example",
    "build_training_examples",
    "find_split_leakage",
    "generate_curriculum",
    "generate_dataset",
    "generate_jsonl_dataset",
    "parse_canonical_trace",
    "parse_final_answer",
    "parse_model_output",
    "parse_trace",
    "persist_curriculum",
    "write_curriculum_jsonl",
    "write_dataset",
    "write_jsonl",
]
