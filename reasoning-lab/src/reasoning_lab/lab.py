"""High-level orchestration for data, checkpoints, experiments, and the UI API."""

from __future__ import annotations

import hashlib
import json
import math
import os
from collections import Counter
from collections.abc import Mapping, Sequence
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path
from time import perf_counter
from typing import Any
from uuid import uuid4

from reasoning_lab.baselines import NGramLanguageModel
from reasoning_lab.checkpoint import LoadedCheckpoint, load_checkpoint
from reasoning_lab.config import ProjectConfig, load_project_config
from reasoning_lab.data import (
    Curriculum,
    Episode,
    Split,
    generate_curriculum,
    persist_curriculum,
    write_curriculum_jsonl,
)
from reasoning_lab.db import LabRepository
from reasoning_lab.inference import (
    EFFORT_POLICIES,
    Effort,
    InferenceResult,
    Objective,
    TokenStep,
    generate,
    make_query_prompt,
    make_world_prompt,
    prompt_prefix,
)
from reasoning_lab.paths import (
    CHECKPOINT_REGISTRY_PATH,
    CHECKPOINTS_ROOT,
    DATABASE_PATH,
    GENERATED_DATA_ROOT,
    LATEST_EVALUATION_PATH,
    MANIFEST_ROOT,
    REPORTS_ROOT,
)
from reasoning_lab.retrieval import RetrievalResult, Retriever
from reasoning_lab.task import (
    VARIABLES,
    BinaryOperation,
    Expr,
    Variable,
    evaluate_with_trace,
    parse_expression,
    render_expression,
    validate_bindings,
    variables_in,
)
from reasoning_lab.tokenizer import FixedTokenizer, get_tokenizer
from reasoning_lab.tool_agent import ToolAgentResult, run_scripted_tool_agent
from reasoning_lab.training import TrainingExample as TrainerExample
from reasoning_lab.training import train_profile as train_neural_profile

NEURAL_PROFILES = ("window_mlp", "dense_direct", "dense_scratch", "moe_scratch")
ALL_PROFILES = ("ngram", *NEURAL_PROFILES)
PROFILE_OBJECTIVE: dict[str, Objective] = {
    "ngram": "direct",
    "window_mlp": "direct",
    "dense_direct": "direct",
    "dense_scratch": "scratch",
    "moe_scratch": "scratch",
}


def _expression_ast_payload(expression: Expr) -> dict[str, Any]:
    if isinstance(expression, Variable):
        return {
            "node_type": "variable",
            "name": expression.name,
            "depth": expression.depth,
        }
    assert isinstance(expression, BinaryOperation)
    return {
        "node_type": "binary_operation",
        "operator": expression.operator,
        "depth": expression.depth,
        "left": _expression_ast_payload(expression.left),
        "right": _expression_ast_payload(expression.right),
    }


def _token_entry(
    tokenizer: FixedTokenizer,
    token_id: int,
    *,
    position: int,
    origin: str,
    role: str,
) -> dict[str, Any]:
    return {
        "position": position,
        "token_id": token_id,
        "token_text": tokenizer.token_for_id(token_id),
        "origin": origin,
        "role": role,
    }


def _tokenization_payload(
    tokenizer: FixedTokenizer,
    *,
    prompt_text: str,
    objective: Objective | None,
    consumed_by_model: bool,
) -> dict[str, Any]:
    prompt_ids = list(tokenizer.encode(prompt_text))
    prompt_tokens = [
        _token_entry(
            tokenizer,
            token_id,
            position=position,
            origin="prompt_text",
            role="prompt",
        )
        for position, token_id in enumerate(prompt_ids)
    ]
    prefix_tokens: list[dict[str, Any]] = []
    if consumed_by_model:
        if objective not in {"direct", "scratch"}:
            raise ValueError("MODEL_CONSUMED_PROMPT_REQUIRES_OBJECTIVE")
        prefix_ids = prompt_prefix(
            prompt_text,
            objective,
            tokenizer,
        )
        prompt_start = 2
        prompt_end = prompt_start + len(prompt_ids)
        for position, token_id in enumerate(prefix_ids):
            if position == 0:
                role = "bos"
                origin = "host_protocol"
            elif position == 1:
                role = "prompt_marker"
                origin = "host_protocol"
            elif prompt_start <= position < prompt_end:
                role = "prompt"
                origin = "prompt_text"
            elif position == len(prefix_ids) - 2:
                role = "segment_terminator"
                origin = "host_protocol"
            else:
                role = "objective_marker"
                origin = "host_protocol"
            prefix_tokens.append(
                _token_entry(
                    tokenizer,
                    token_id,
                    position=position,
                    origin=origin,
                    role=role,
                )
            )
    return {
        "consumed_by_model": consumed_by_model,
        "prompt_text": prompt_text,
        "prompt_tokens": prompt_tokens,
        "prefix_tokens": prefix_tokens,
    }


def _execution_payload(
    *,
    model: str,
    mode: str,
    objective: Objective | None,
) -> dict[str, Any]:
    model_invoked = mode in {"model_only", "rag"}
    if mode == "tools":
        return {
            "path": ["input", "tools", "answer"],
            "answer_source": "scripted_tool_controller",
            "objective": None,
            "model_invoked": False,
        }
    if mode == "oracle":
        return {
            "path": ["input", "oracle", "answer"],
            "answer_source": "oracle",
            "objective": None,
            "model_invoked": False,
        }
    path = ["input"]
    if mode == "rag":
        path.append("retrieval")
    path.extend(("tokenization", "model"))
    if model == "ngram":
        path.append("ngram_count")
    else:
        path.append("attention_or_mlp")
        if model == "moe_scratch":
            path.append("moe")
    path.append("candidates")
    if objective == "scratch":
        path.append("verification")
    path.append("answer")
    return {
        "path": path,
        "answer_source": "rag_model" if mode == "rag" else "model",
        "objective": objective,
        "model_invoked": model_invoked,
    }


def _decoding_payload(
    *,
    model: str,
    effort: Effort,
    model_invoked: bool,
    objective: Objective | None,
) -> dict[str, Any]:
    if not model_invoked:
        return {
            "probability_basis": "not_applicable",
            "constraint": None,
            "temperature": None,
            "top_k": None,
        }
    if model == "ngram":
        return {
            "probability_basis": "normalized_digit_counts",
            "constraint": "digits_0_9",
            "temperature": 0.0,
            "top_k": 1,
        }
    policy = EFFORT_POLICIES[effort]
    return {
        "probability_basis": "post_constraint_temperature_top_k",
        "constraint": ("grammar_constrained_slots" if objective == "scratch" else "digits_0_9"),
        "temperature": policy.temperature,
        "top_k": policy.top_k,
    }


def _selection_payload(result: Mapping[str, Any], *, model: str) -> dict[str, Any]:
    raw_candidates = result.get("candidates")
    candidates = raw_candidates if isinstance(raw_candidates, Sequence) else []
    answers = [
        candidate.get("final_answer")
        for candidate in candidates
        if isinstance(candidate, Mapping) and candidate.get("final_answer") is not None
    ]
    majority_answer = Counter(answers).most_common(1)[0][0] if answers else None
    applicable = bool(candidates)
    selected_index = int(result.get("selected_index", 0)) if applicable else None
    criteria = (
        ["highest_count", "lowest_token_id"]
        if model == "ngram" and applicable
        else [
            "protocol_valid",
            "verifier_score",
            "majority_match",
            "normalized_logprob",
            "earlier_index",
        ]
        if applicable
        else []
    )
    return {
        "applicable": applicable,
        "candidate_count": len(candidates),
        "selected_index": selected_index,
        "majority_answer": majority_answer,
        "ordered_criteria": criteria,
    }


def _verification_payload(
    result: Mapping[str, Any],
    *,
    objective: Objective | None,
    model_invoked: bool,
) -> dict[str, Any]:
    candidates = result.get("candidates")
    candidate_count = len(candidates) if isinstance(candidates, Sequence) else 0
    applicable = model_invoked and objective == "scratch"
    return {
        "applicable": applicable,
        "kind": "public_generated_trace_protocol" if applicable else "not_applicable",
        "passes": candidate_count if applicable else 0,
        "selected_protocol_valid": result.get("protocol_valid") if applicable else None,
        "legacy_reported_passes": int(result.get("verifier_passes", 0)),
    }


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _atomic_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
    temporary.write_text(
        json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )
    os.replace(temporary, path)


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


class CheckpointRegistry:
    def __init__(self, path: Path = CHECKPOINT_REGISTRY_PATH) -> None:
        self.path = path

    def load(self) -> dict[str, Any]:
        if not self.path.exists():
            return {"format": "reasoning-lab-registry-v1", "profiles": {}}
        decoded = json.loads(self.path.read_text(encoding="utf-8"))
        if not isinstance(decoded, dict) or decoded.get("format") != "reasoning-lab-registry-v1":
            raise ValueError("UNSUPPORTED_CHECKPOINT_REGISTRY")
        profiles = decoded.get("profiles")
        if not isinstance(profiles, dict):
            raise TypeError("CHECKPOINT_REGISTRY_PROFILES_MUST_BE_AN_OBJECT")
        return decoded

    def register(self, profile: str, record: Mapping[str, Any]) -> None:
        if profile not in ALL_PROFILES:
            raise ValueError(f"UNKNOWN_PROFILE: {profile}")
        registry = self.load()
        profiles = dict(registry["profiles"])
        profiles[profile] = dict(record)
        _atomic_json(
            self.path,
            {
                "format": "reasoning-lab-registry-v1",
                "updated_at": _now(),
                "profiles": profiles,
            },
        )

    def profile(self, name: str) -> dict[str, Any]:
        profiles = self.load()["profiles"]
        if name not in profiles:
            raise FileNotFoundError(
                f"Checkpoint {name!r} is unavailable; run `reasoning-lab train {name}` first"
            )
        record = profiles[name]
        if not isinstance(record, dict):
            raise TypeError("CHECKPOINT_PROFILE_RECORD_MUST_BE_AN_OBJECT")
        return record

    def available(self) -> tuple[str, ...]:
        return tuple(sorted(self.load()["profiles"]))


def build_data(
    config: ProjectConfig | None = None,
    *,
    repository: LabRepository | None = None,
) -> dict[str, Any]:
    project = config or load_project_config()
    repo = repository or LabRepository(DATABASE_PATH)
    repo.initialize()
    run_id = repo.create_run(kind="data", config=project.data.to_dict(), seed=project.data.seed)
    try:
        curriculum = generate_curriculum(
            project.data,
            max_sequence_length=project.model.context_length,
        )
        manifest = write_curriculum_jsonl(
            curriculum,
            GENERATED_DATA_ROOT,
            manifest_dir=MANIFEST_ROOT,
        )
        manifest_path = MANIFEST_ROOT / "dataset-manifest.json"
        dataset_version_id = persist_curriculum(
            repo,
            curriculum,
            manifest_path=manifest_path,
        )
        repo.add_metric(
            run_id=run_id,
            name="episode_count",
            value=float(len(curriculum.episodes)),
            unit="episodes",
        )
        repo.add_metric(
            run_id=run_id,
            name="training_example_count",
            value=float(len(curriculum.examples)),
            unit="examples",
        )
        repo.add_artifact(run_id=run_id, kind="dataset_manifest", path=manifest_path)
        repo.finish_run(run_id, passed=True)
        return {
            "run_id": run_id,
            "dataset_version_id": dataset_version_id,
            "dataset_sha256": curriculum.dataset_sha256,
            "manifest_sha256": manifest.manifest_sha256,
            "tokenizer_sha256": curriculum.tokenizer_sha256,
            "split_counts": curriculum.counts_by_split(),
            "worlds": len(curriculum.worlds),
            "documents": len(curriculum.documents),
            "episodes": len(curriculum.episodes),
            "examples": len(curriculum.examples),
            "database": str(repo.path.resolve()),
        }
    except Exception as error:
        repo.finish_run(run_id, passed=False, error=str(error))
        raise


def _curriculum(config: ProjectConfig) -> Curriculum:
    return generate_curriculum(
        config.data,
        max_sequence_length=config.model.context_length,
    )


def _trainer_examples(curriculum: Curriculum) -> tuple[TrainerExample, ...]:
    tokenizer = get_tokenizer()
    converted: list[TrainerExample] = []
    for example in curriculum.examples:
        metadata: Mapping[str, Any]
        if example.objective == "scratch":
            # Grammar-constrained inference supplies structural DSL tokens.
            # Train scratch models on the decision-bearing numeric slots so a
            # low aggregate loss cannot be dominated by fixed punctuation.
            loss_mask = tuple(
                selected and tokenizer.token_for_id(token_id) in tuple("0123456789")
                for token_id, selected in zip(example.token_ids, example.loss_mask, strict=True)
            )
            metadata = {**example.metadata, "training_mask": "decision_tokens_only"}
        else:
            loss_mask = example.loss_mask
            metadata = example.metadata
        converted.append(
            TrainerExample(
                token_ids=example.token_ids,
                loss_mask=loss_mask,
                objective=example.objective,
                split=example.split,
                episode_id=example.episode_id,
                metadata=metadata,
            )
        )
    return tuple(converted)


def train_profile(
    profile: str,
    *,
    config: ProjectConfig | None = None,
    repository: LabRepository | None = None,
    curriculum: Curriculum | None = None,
) -> dict[str, Any]:
    if profile not in ALL_PROFILES:
        raise ValueError(f"UNKNOWN_PROFILE: {profile}")
    project = config or load_project_config()
    repo = repository or LabRepository(DATABASE_PATH)
    repo.initialize()
    corpus = curriculum or _curriculum(project)
    dataset_version_id = repo.register_dataset(
        dataset_hash=corpus.dataset_sha256,
        config={
            "seed": corpus.seed,
            "tokenizer_sha256": corpus.tokenizer_sha256,
            "split_counts": corpus.counts_by_split(),
        },
        manifest_path=str(MANIFEST_ROOT / "dataset-manifest.json"),
    )
    run_id = repo.create_run(
        kind="train",
        model_kind=profile,
        dataset_version_id=dataset_version_id,
        config=(
            {"order": 8, "objective": "direct"}
            if profile == "ngram"
            else project.training_for(profile).to_dict()
        ),
        seed=project.lab.seed,
    )
    checkpoint_dir = CHECKPOINTS_ROOT / profile / run_id
    tokenizer = get_tokenizer()
    parameter_counts: dict[str, Any]
    telemetry: dict[str, Any]
    artifact_paths: tuple[Path, ...]
    try:
        if profile == "ngram":
            direct_sequences = (
                example.token_ids for example in corpus.examples_for("train", "direct")
            )
            model = NGramLanguageModel(order=8, vocab_size=tokenizer.vocab_size)
            model.fit(direct_sequences)
            checkpoint_dir.mkdir(parents=True, exist_ok=False)
            checkpoint_path = checkpoint_dir / "ngram.json"
            payload = model.save(checkpoint_path)
            checkpoint_sha = str(payload["model_sha256"])
            final_loss = None
            parameter_counts = {"total": 0, "active_estimate": 0}
            telemetry = {
                "order": model.order,
                "observations": model.observations,
                "contexts": model.context_count,
            }
            artifact_paths = (checkpoint_path,)
        else:
            result = train_neural_profile(
                profile,
                project,
                _trainer_examples(corpus),
                vocab_size=tokenizer.vocab_size,
                pad_token_id=tokenizer.pad_id,
                checkpoint_dir=checkpoint_dir,
                checkpoint_metadata={
                    "dataset_sha256": corpus.dataset_sha256,
                    "tokenizer_sha256": tokenizer.vocabulary_sha256,
                    "curriculum_format": "reasoning-lab-curriculum-v1",
                },
                seed=project.lab.seed,
            )
            metadata = result.checkpoint_metadata
            assert metadata is not None
            checkpoint_path = checkpoint_dir
            checkpoint_sha = str(metadata["checkpoint_sha256"])
            final_loss = result.telemetry.steps[-1].total_loss
            parameter_counts = result.model.parameter_counts()
            telemetry = result.telemetry.to_dict()
            artifact_paths = (
                checkpoint_dir / "model.safetensors",
                checkpoint_dir / "checkpoint.json",
            )
            repo.add_metric(
                run_id=run_id,
                name="final_training_loss",
                value=float(final_loss),
                unit="cross_entropy_plus_auxiliary",
            )
            for validation in result.telemetry.validations:
                repo.add_metric(
                    run_id=run_id,
                    split="validation",
                    name="validation_token_loss",
                    value=validation.token_loss,
                    unit="cross_entropy",
                    dimensions={"step": validation.step, "profile": profile},
                )
        for artifact_path in artifact_paths:
            repo.add_artifact(
                run_id=run_id,
                kind="checkpoint",
                path=artifact_path,
                metadata={"profile": profile},
            )
        CheckpointRegistry().register(
            profile,
            {
                "profile": profile,
                "objective": PROFILE_OBJECTIVE[profile],
                "path": str(checkpoint_path.resolve()),
                "checkpoint_sha256": checkpoint_sha,
                "dataset_sha256": corpus.dataset_sha256,
                "tokenizer_sha256": tokenizer.vocabulary_sha256,
                "seed": project.lab.seed,
                "parameter_counts": parameter_counts,
                "trained_at": _now(),
                "run_id": run_id,
            },
        )
        repo.finish_run(run_id, passed=True)
        return {
            "run_id": run_id,
            "profile": profile,
            "objective": PROFILE_OBJECTIVE[profile],
            "checkpoint": str(checkpoint_path.resolve()),
            "checkpoint_sha256": checkpoint_sha,
            "dataset_sha256": corpus.dataset_sha256,
            "tokenizer_sha256": tokenizer.vocabulary_sha256,
            "parameter_counts": parameter_counts,
            "final_loss": final_loss,
            "telemetry": telemetry,
        }
    except Exception as error:
        repo.finish_run(run_id, passed=False, error=str(error))
        raise


def train_all(
    config: ProjectConfig | None = None,
    *,
    repository: LabRepository | None = None,
) -> list[dict[str, Any]]:
    project = config or load_project_config()
    repo = repository or LabRepository(DATABASE_PATH)
    repo.initialize()
    corpus = _curriculum(project)
    return [
        train_profile(
            profile,
            config=project,
            repository=repo,
            curriculum=corpus,
        )
        for profile in ALL_PROFILES
    ]


class Laboratory:
    """Stateful local service with cached, integrity-checked checkpoints."""

    def __init__(
        self,
        *,
        config: ProjectConfig | None = None,
        repository: LabRepository | None = None,
        registry: CheckpointRegistry | None = None,
        tokenizer: FixedTokenizer | None = None,
    ) -> None:
        self.config = config or load_project_config()
        self.repository = repository or LabRepository(DATABASE_PATH)
        self.repository.initialize()
        self.registry = registry or CheckpointRegistry()
        self.tokenizer = tokenizer or get_tokenizer()
        self.retriever = Retriever(self.repository)
        self._neural_cache: dict[str, LoadedCheckpoint] = {}
        self._ngram_cache: tuple[str, NGramLanguageModel] | None = None

    @staticmethod
    def normalize_facts(facts: Mapping[str, int]) -> dict[str, int]:
        normalized = validate_bindings(facts)
        return {name: normalized.get(name, 0) for name in VARIABLES}

    def _interactive_world(self, facts: Mapping[str, int]) -> str:
        normalized = self.normalize_facts(facts)
        facts_json = _canonical_json(normalized)
        dataset_hash = _sha256_text("reasoning-lab-interactive-v1")
        dataset_id = self.repository.register_dataset(
            dataset_hash=dataset_hash,
            config={"purpose": "interactive", "version": 1},
        )
        world_id = f"interactive_{_sha256_text(facts_json)[:24]}"
        self.repository.put_world(
            world_id=world_id,
            dataset_version_id=dataset_id,
            split="iid_test",
            facts=normalized,
        )
        for variable, value in normalized.items():
            self.repository.put_document(
                document_id=f"document_{world_id}_{variable}",
                world_id=world_id,
                variable=variable,
                value=value,
                content=f"Fact {variable}: variable {variable} has value {value}.",
                source_uri=f"microworld://{world_id}/{variable}",
                metadata={"interactive": True},
            )
        return world_id

    def _load_neural(self, profile: str) -> tuple[LoadedCheckpoint, dict[str, Any]]:
        record = self.registry.profile(profile)
        if record.get("tokenizer_sha256") != self.tokenizer.vocabulary_sha256:
            raise ValueError("CHECKPOINT_TOKENIZER_SHA256_MISMATCH")
        path = str(record["path"])
        cached = self._neural_cache.get(profile)
        if cached is None or str(cached.directory) != str(Path(path).resolve()):
            cached = load_checkpoint(Path(path))
            self._neural_cache[profile] = cached
        return cached, record

    def _load_ngram(self) -> tuple[NGramLanguageModel, dict[str, Any]]:
        record = self.registry.profile("ngram")
        if record.get("tokenizer_sha256") != self.tokenizer.vocabulary_sha256:
            raise ValueError("CHECKPOINT_TOKENIZER_SHA256_MISMATCH")
        path = str(record["path"])
        if self._ngram_cache is None or self._ngram_cache[0] != path:
            self._ngram_cache = (path, NGramLanguageModel.load(Path(path)))
        return self._ngram_cache[1], record

    def _run_ngram(
        self,
        *,
        prompt_text: str,
        effort: Effort,
    ) -> dict[str, Any]:
        started = perf_counter()
        model, record = self._load_ngram()
        prefix = prompt_prefix(prompt_text, "direct", self.tokenizer)
        counts = model.next_token_counts(prefix)
        digit_counts = {
            token_id: count
            for token_id, count in counts.items()
            if self.tokenizer.token_for_id(token_id) in tuple("0123456789")
        }
        if not digit_counts:
            raise RuntimeError("NGRAM_HAS_NO_DIGIT_CONTINUATION")
        total = sum(digit_counts.values())
        chosen = min(digit_counts, key=lambda token_id: (-digit_counts[token_id], token_id))
        answer = int(self.tokenizer.token_for_id(chosen))
        probabilities = tuple(
            sorted(
                (
                    (self.tokenizer.token_for_id(token_id), count / total)
                    for token_id, count in digit_counts.items()
                ),
                key=lambda item: (-item[1], item[0]),
            )[:5]
        )
        policy = EFFORT_POLICIES[effort]
        token_step = TokenStep(
            position=len(prefix),
            token_id=chosen,
            token_text=str(answer),
            logprob=0.0
            if digit_counts[chosen] == total
            else float(math.log(digit_counts[chosen] / total)),
            top_probabilities=probabilities,
        )
        candidate = {
            "output_text": f"<FINAL>{answer}",
            "final_answer": answer,
            "normalized_logprob": token_step.logprob,
            "protocol_valid": True,
            "verifier_score": 0.5,
            "generated_tokens": 1,
            "forward_passes": 0,
            "selected": True,
            "metadata": {"deterministic_duplicate_count": policy.candidates},
        }
        return {
            "answer": answer,
            "output_text": candidate["output_text"],
            "scratchpad": None,
            "trace_steps": [],
            "protocol_valid": True,
            "effort": effort,
            "candidates": [candidate],
            "elapsed_ms": (perf_counter() - started) * 1000.0,
            "total_generated_tokens": 1,
            "total_forward_passes": 0,
            "verifier_passes": 0,
            "count_lookups": policy.candidates,
            "token_steps": [token_step.to_dict()],
            "attention": None,
            "routing": [],
            "checkpoint_sha256": record["checkpoint_sha256"],
        }

    def _run_model(
        self,
        *,
        profile: str,
        prompt_text: str,
        expression: str,
        facts: Mapping[str, int],
        effort: Effort,
        capture: bool,
    ) -> dict[str, Any]:
        if profile == "ngram":
            return self._run_ngram(prompt_text=prompt_text, effort=effort)
        loaded, record = self._load_neural(profile)
        result: InferenceResult = generate(
            loaded.model,
            prompt_text=prompt_text,
            expression=expression,
            facts=facts,
            objective=PROFILE_OBJECTIVE[profile],
            effort=effort,
            seed=self.config.lab.seed,
            capture=capture,
            tokenizer=self.tokenizer,
        )
        return {**result.to_dict(), "checkpoint_sha256": record["checkpoint_sha256"]}

    def solve(
        self,
        *,
        model: str,
        mode: str,
        effort: Effort,
        expression: str,
        facts: Mapping[str, int],
        capture: bool = True,
    ) -> dict[str, Any]:
        if model not in ALL_PROFILES:
            raise ValueError(f"UNKNOWN_MODEL_PROFILE: {model}")
        if mode not in {"model_only", "rag", "tools", "oracle"}:
            raise ValueError(f"UNKNOWN_ASSISTANCE_MODE: {mode}")
        if effort not in EFFORT_POLICIES:
            raise ValueError(f"UNKNOWN_EFFORT: {effort}")
        parsed = parse_expression(expression, max_depth=8)
        canonical_expression = render_expression(parsed)
        normalized_facts = self.normalize_facts(facts)
        world_id = self._interactive_world(normalized_facts)
        retrieval: RetrievalResult | None = None
        checkpoint_sha: str | None = None
        rag_model_facts: dict[str, int] | None = None
        rag_missing_variables: list[str] = []

        if mode == "rag":
            retrieval = self.retriever.retrieve(
                expression=canonical_expression,
                world_id=world_id,
                mode="fts5",
                top_k=8,
                record=False,
            )
            retrieved_facts = {hit.variable: hit.value for hit in retrieval.hits}
            required_variables = variables_in(parsed)
            model_facts = {name: retrieved_facts.get(name, 0) for name in required_variables}
            rag_model_facts = model_facts
            rag_missing_variables = [
                name for name in required_variables if name not in retrieved_facts
            ]
            prompt_text = make_world_prompt(canonical_expression, model_facts)
            result = self._run_model(
                profile=model,
                prompt_text=prompt_text,
                expression=canonical_expression,
                facts=model_facts,
                effort=effort,
                capture=capture,
            )
            checkpoint_sha = result.get("checkpoint_sha256")
        elif mode == "model_only":
            prompt_text = make_world_prompt(canonical_expression, normalized_facts)
            result = self._run_model(
                profile=model,
                prompt_text=prompt_text,
                expression=canonical_expression,
                facts=normalized_facts,
                effort=effort,
                capture=capture,
            )
            checkpoint_sha = result.get("checkpoint_sha256")
        elif mode == "tools":
            prompt_text = make_query_prompt(canonical_expression)
            tool_result: ToolAgentResult = run_scripted_tool_agent(
                canonical_expression,
                normalized_facts,
                max_calls=16,
            )
            result = {
                **tool_result.to_dict(),
                "output_text": tool_result.transcript[-1],
                "scratchpad": None,
                "protocol_valid": tool_result.status == "ok",
                "effort": effort,
                "candidates": [],
                "total_generated_tokens": 0,
                "total_forward_passes": 0,
                "verifier_passes": 0,
                "token_steps": [],
                "attention": None,
                "routing": [],
            }
        else:
            prompt_text = make_query_prompt(canonical_expression)
            started = perf_counter()
            oracle = evaluate_with_trace(canonical_expression, normalized_facts)
            result = {
                "answer": oracle.value,
                "output_text": f"<FINAL>{oracle.value}",
                "scratchpad": None,
                "trace_steps": [step.render() for step in oracle.trace],
                "protocol_valid": True,
                "effort": effort,
                "candidates": [],
                "elapsed_ms": (perf_counter() - started) * 1000.0,
                "total_generated_tokens": 0,
                "total_forward_passes": 0,
                "verifier_passes": 0,
                "token_steps": [],
                "attention": None,
                "routing": [],
            }

        canonical_reference_result = evaluate_with_trace(
            canonical_expression,
            normalized_facts,
        )
        gold = canonical_reference_result.value
        selected_answer = result.get("answer")
        is_correct = selected_answer == gold
        trace_id = self.repository.record_inference(
            run_id=None,
            episode_id=None,
            model_kind=model
            if mode in {"model_only", "rag"}
            else str(result.get("controller", mode)),
            mode=mode,
            effort=effort,
            prompt_text=prompt_text,
            selected_answer=selected_answer,
            is_correct=is_correct,
            elapsed_ms=float(result.get("elapsed_ms", 0.0)),
            total_generated_tokens=int(result.get("total_generated_tokens", 0)),
            total_forward_passes=int(result.get("total_forward_passes", 0)),
            verifier_passes=int(result.get("verifier_passes", 0)),
            metadata={
                "expression": canonical_expression,
                "world_id": world_id,
                "checkpoint_sha256": checkpoint_sha,
                "capability_status": "IMPLEMENTED",
                "evidence_class": (
                    "MODEL"
                    if mode == "model_only"
                    else "ORACLE"
                    if mode == "oracle"
                    else "EXTERNAL"
                ),
                "learned_tool_policy": result.get("learned_policy"),
            },
        )
        candidate_ids: list[str] = []
        if result.get("candidates"):
            candidate_ids = self.repository.record_candidates(
                trace_id,
                result["candidates"],
            )
            selected_index = int(result.get("selected_index", 0))
            if candidate_ids:
                selected_candidate_id = candidate_ids[min(selected_index, len(candidate_ids) - 1)]
                self.repository.record_token_steps(
                    candidate_id=selected_candidate_id,
                    steps=result.get("token_steps", []),
                    attention=result.get("attention"),
                    routing=result.get("routing"),
                )
                if result.get("routing"):
                    self.repository.record_moe_routing(
                        trace_id=trace_id,
                        candidate_id=selected_candidate_id,
                        summaries=result["routing"],
                    )
        if retrieval is not None:
            assert rag_model_facts is not None
            self.repository.record_retrieval(
                trace_id=trace_id,
                world_id=world_id,
                method="fts5",
                query_text=retrieval.query,
                elapsed_ms=retrieval.elapsed_ms,
                hits=retrieval.hits,
                top_k=8,
            )
            result["retrieval"] = {
                "method": retrieval.method,
                "query": retrieval.query,
                "elapsed_ms": retrieval.elapsed_ms,
                "hits": [asdict(hit) for hit in retrieval.hits],
                "context": retrieval.context,
                "model_facts": rag_model_facts,
                "missing_variables": rag_missing_variables,
                "injected_prompt": prompt_text,
            }
        if mode == "tools":
            for call in result.get("tool_calls", []):
                self.repository.record_tool_call(
                    trace_id=trace_id,
                    candidate_id=None,
                    call_index=int(call["index"]),
                    tool_name=str(call["name"]),
                    arguments=call["arguments"],
                    result=call["result"],
                    status=str(call["status"]),
                    elapsed_ms=float(call["elapsed_ms"]),
                    error=call["error"],
                )
        model_invoked = mode in {"model_only", "rag"}
        objective = PROFILE_OBJECTIVE[model] if model_invoked else None
        execution = _execution_payload(model=model, mode=mode, objective=objective)
        tokenization = _tokenization_payload(
            self.tokenizer,
            prompt_text=prompt_text,
            objective=objective,
            consumed_by_model=model_invoked,
        )
        canonical_reference = {
            "label": "canonical_reference_computed_after_inference",
            "phase": "after_inference",
            "source": "deterministic_task_evaluator",
            "used_for_candidate_selection": False,
            "answer": canonical_reference_result.value,
            "trace_steps": [
                {
                    **step.to_dict(),
                    "text": step.render(),
                    "origin": "canonical_reference_after_inference",
                }
                for step in canonical_reference_result.trace
            ],
        }
        return {
            **result,
            "schema_version": "solve-v2",
            "trace_id": trace_id,
            "model": model,
            "mode": mode,
            "expression": canonical_expression,
            "expression_ast": _expression_ast_payload(parsed),
            "facts": normalized_facts,
            "correct": is_correct,
            "gold_answer_after_inference": gold,
            "canonical_reference": canonical_reference,
            "checkpoint_sha256": checkpoint_sha,
            "input_tokens": list(self.tokenizer.encode(prompt_text)),
            "execution": execution,
            "tokenization": tokenization,
            "decoding": _decoding_payload(
                model=model,
                effort=effort,
                model_invoked=model_invoked,
                objective=objective,
            ),
            "selection": _selection_payload(result, model=model),
            "verification": _verification_payload(
                result,
                objective=objective,
                model_invoked=model_invoked,
            ),
        }

    def status(self) -> dict[str, Any]:
        available = self.registry.available()
        comparison: list[dict[str, Any]] = []
        effort_comparison: list[dict[str, Any]] = []
        if LATEST_EVALUATION_PATH.exists():
            report = json.loads(LATEST_EVALUATION_PATH.read_text(encoding="utf-8"))
            comparison = list(report.get("comparison", []))
            effort_comparison = list(report.get("effort_comparison", []))
        records = self.registry.load()["profiles"]
        split_counts = {
            "train": self.config.data.train_episodes,
            "validation": self.config.data.validation_episodes,
            "iid_test": self.config.data.iid_test_episodes,
            "depth_ood": self.config.data.depth_ood_episodes,
            "rag_holdout": self.config.data.rag_holdout_episodes,
        }
        total_episodes = sum(split_counts.values())
        return {
            "status": "ready",
            "database": str(self.repository.path.resolve()),
            "database_counts": self.repository.table_counts(),
            "models_ready": len(available),
            "available_models": list(available),
            "profiles": records,
            "corpus_summary": {
                "generation": "deterministic_synthetic_curriculum",
                "seed": self.config.data.seed,
                "split_counts": split_counts,
                "total_episodes": total_episodes,
                "objectives_per_episode": ["direct", "scratch", "tool"],
                "training_examples": total_episodes * 3,
                "train_max_depth": self.config.data.train_max_depth,
                "ood_depth": self.config.data.ood_depth,
                "vocabulary_size": self.tokenizer.vocab_size,
                "tokenizer_sha256": self.tokenizer.vocabulary_sha256,
            },
            "model_config": self.config.model.to_dict(),
            "comparison": comparison,
            "effort_comparison": effort_comparison,
            "default_sample": {
                "facts": {
                    "A": 3,
                    "B": 5,
                    "C": 2,
                    "D": 7,
                    "E": 1,
                    "F": 4,
                    "G": 9,
                    "H": 6,
                },
                "expression": "MUL(ADD(A,B),C)",
                "answer": 6,
            },
            "claim_boundary": "Generated scratchpads and telemetry are not hidden thoughts or causal explanations.",
        }


def evaluate_profiles(
    *,
    limit_per_split: int | None = None,
    config: ProjectConfig | None = None,
    repository: LabRepository | None = None,
) -> dict[str, Any]:
    project = config or load_project_config()
    repo = repository or LabRepository(DATABASE_PATH)
    lab = Laboratory(config=project, repository=repo)
    corpus = _curriculum(project)
    world_facts = {world.world_id: dict(world.facts) for world in corpus.worlds}
    limit = limit_per_split or project.lab.evaluation_limit_per_split
    run_id = repo.create_run(
        kind="evaluate",
        config={"limit_per_split": limit, "effort": "low"},
        seed=project.lab.seed,
    )
    rows: list[dict[str, Any]] = []
    try:
        evaluation_splits: tuple[Split, ...] = ("iid_test", "depth_ood")
        for profile in lab.registry.available():
            if profile not in ALL_PROFILES:
                continue
            record = lab.registry.profile(profile)
            split_scores: dict[str, float] = {}
            for split in evaluation_splits:
                episodes = corpus.episodes_for(split)[:limit]
                correct = 0
                for episode in episodes:
                    result = lab.solve(
                        model=profile,
                        mode="model_only",
                        effort="low",
                        expression=episode.expression,
                        facts=world_facts[episode.world_id],
                        capture=False,
                    )
                    correct += int(result["answer"] == episode.gold_answer)
                split_scores[split] = correct / max(1, len(episodes))

            rag_episodes = corpus.episodes_for("rag_holdout")[:limit]
            rag_correct = 0
            no_rag_correct = 0
            for episode in rag_episodes:
                facts = world_facts[episode.world_id]
                rag_result = lab.solve(
                    model=profile,
                    mode="rag",
                    effort="low",
                    expression=episode.expression,
                    facts=facts,
                    capture=False,
                )
                rag_correct += int(rag_result["answer"] == episode.gold_answer)
                # This control uses a query-only prompt and therefore requires a
                # low-level run; no submitted facts enter the model context.
                no_rag_model = lab._run_model(
                    profile=profile,
                    prompt_text=make_query_prompt(episode.expression),
                    expression=episode.expression,
                    facts={},
                    effort="low",
                    capture=False,
                )
                no_rag_correct += int(no_rag_model["answer"] == episode.gold_answer)
            rag_accuracy = rag_correct / max(1, len(rag_episodes))
            no_rag_accuracy = no_rag_correct / max(1, len(rag_episodes))
            common = {
                "model_kind": profile,
                "active_parameters": record.get("parameter_counts", {}).get("active_estimate", 0),
                "total_parameters": record.get("parameter_counts", {}).get("total", 0),
                "checkpoint_sha256": record["checkpoint_sha256"],
                "available": True,
            }
            rows.extend(
                (
                    {
                        **common,
                        "label": f"{profile} / model only",
                        "mode": "model_only",
                        "iid_accuracy": split_scores["iid_test"],
                        "depth_ood_accuracy": split_scores["depth_ood"],
                        "rag_holdout_accuracy": no_rag_accuracy,
                    },
                    {
                        **common,
                        "label": f"{profile} / RAG",
                        "mode": "rag",
                        "iid_accuracy": None,
                        "depth_ood_accuracy": None,
                        "rag_holdout_accuracy": rag_accuracy,
                    },
                )
            )
            for metric_name, value in (
                ("iid_accuracy", split_scores["iid_test"]),
                ("depth_ood_accuracy", split_scores["depth_ood"]),
                ("rag_holdout_accuracy", rag_accuracy),
                ("no_retrieval_accuracy", no_rag_accuracy),
            ):
                repo.add_metric(
                    run_id=run_id,
                    name=metric_name,
                    value=value,
                    unit="fraction",
                    dimensions={"profile": profile},
                )

        tool_episodes: Sequence[Episode] = corpus.episodes_for("depth_ood")[:limit]
        tool_correct = sum(
            run_scripted_tool_agent(episode.expression, world_facts[episode.world_id]).answer
            == episode.gold_answer
            for episode in tool_episodes
        )
        rows.append(
            {
                "label": "scripted controller / tools",
                "model_kind": "scripted_ast_controller",
                "mode": "tools",
                "iid_accuracy": None,
                "depth_ood_accuracy": tool_correct / max(1, len(tool_episodes)),
                "rag_holdout_accuracy": None,
                "active_parameters": 0,
                "total_parameters": 0,
                "available": True,
                "learned_policy": False,
            }
        )
        effort_rows: list[dict[str, Any]] = []
        effort_profile = "dense_scratch"
        if effort_profile in lab.registry.available():
            effort_record = lab.registry.profile(effort_profile)
            effort_episodes = corpus.episodes_for("iid_test")[: min(limit, 12)]
            for effort in ("low", "medium", "high"):
                correct = 0
                protocol_valid = 0
                total_tokens = 0
                total_forwards = 0
                total_latency = 0.0
                for episode in effort_episodes:
                    outcome = lab.solve(
                        model=effort_profile,
                        mode="model_only",
                        effort=effort,
                        expression=episode.expression,
                        facts=world_facts[episode.world_id],
                        capture=False,
                    )
                    correct += int(outcome["answer"] == episode.gold_answer)
                    protocol_valid += int(outcome["protocol_valid"])
                    total_tokens += int(outcome["total_generated_tokens"])
                    total_forwards += int(outcome["total_forward_passes"])
                    total_latency += float(outcome["elapsed_ms"])
                denominator = max(1, len(effort_episodes))
                effort_rows.append(
                    {
                        "effort": effort,
                        "profile": effort_profile,
                        "checkpoint_sha256": effort_record["checkpoint_sha256"],
                        "accuracy": correct / denominator,
                        "protocol_valid_rate": protocol_valid / denominator,
                        "average_generated_tokens": total_tokens / denominator,
                        "average_forward_passes": total_forwards / denominator,
                        "average_latency_ms": total_latency / denominator,
                        "episodes": len(effort_episodes),
                    }
                )
        report = {
            "format": "reasoning-lab-evaluation-v1",
            "run_id": run_id,
            "created_at": _now(),
            "dataset_sha256": corpus.dataset_sha256,
            "tokenizer_sha256": corpus.tokenizer_sha256,
            "seed": project.lab.seed,
            "limit_per_split": limit,
            "comparison": rows,
            "effort_comparison": effort_rows,
            "boundaries": {
                "scratchpad": "generated output, not hidden thought",
                "effort": "compute budget, not guaranteed improvement",
                "rag": "external retrieved context",
                "tools": "host executed; scripted policy is not learned",
                "telemetry": "not a causal explanation",
            },
        }
        REPORTS_ROOT.mkdir(parents=True, exist_ok=True)
        timestamped = REPORTS_ROOT / f"evaluation-{run_id}.json"
        _atomic_json(timestamped, report)
        _atomic_json(LATEST_EVALUATION_PATH, report)
        repo.add_artifact(run_id=run_id, kind="evaluation_report", path=timestamped)
        repo.finish_run(run_id, passed=True)
        return report
    except Exception as error:
        repo.finish_run(run_id, passed=False, error=str(error))
        raise


__all__ = [
    "ALL_PROFILES",
    "NEURAL_PROFILES",
    "CheckpointRegistry",
    "Laboratory",
    "build_data",
    "evaluate_profiles",
    "train_all",
    "train_profile",
]
