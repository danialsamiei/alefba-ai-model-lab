from __future__ import annotations

import hashlib
import json
from dataclasses import replace
from pathlib import Path

import pytest

from reasoning_lab.config import DataConfig
from reasoning_lab.data import (
    DATASET_FORMAT,
    DATASET_GENERATOR_NAME,
    DATASET_GENERATOR_SCHEMA,
    DATASET_GENERATOR_VERSION,
    DATASET_LICENSE,
    DATASET_MANIFEST_SCHEMA,
    OBJECTIVES,
    SPLITS,
    Curriculum,
    assert_no_split_leakage,
    build_inference_prompt,
    build_inference_token_ids,
    build_training_example,
    find_split_leakage,
    generate_curriculum,
    parse_model_output,
    persist_curriculum,
    write_curriculum_jsonl,
)
from reasoning_lab.db import LabRepository
from reasoning_lab.task import (
    ExpressionSyntaxError,
    canonical_trace,
    evaluate_expression,
    evaluate_with_trace,
    expression_depth,
    parse_expression,
    render_expression,
)
from reasoning_lab.tokenizer import (
    CALL_TOKEN,
    FINAL_TOKEN,
    OBS_TOKEN,
    SPECIAL_TOKENS,
    TOKENIZER,
    TokenizationError,
)
from reasoning_lab.tools import parse_tool_call


def tiny_data_config(*, seed: int = 41, max_distractors: int = 2) -> DataConfig:
    return DataConfig(
        seed=seed,
        train_episodes=4,
        validation_episodes=3,
        iid_test_episodes=3,
        depth_ood_episodes=2,
        rag_holdout_episodes=2,
        train_max_depth=2,
        ood_depth=3,
        max_distractors=max_distractors,
    )


def test_parser_renderer_modulo_evaluator_and_trace_are_canonical() -> None:
    source = " SUB( MUL(A, ADD(B,C)), D ) "
    expression = parse_expression(source)
    assert render_expression(expression) == "SUB(MUL(A,ADD(B,C)),D)"
    assert expression_depth(expression) == 3
    world = {"A": 7, "B": 8, "C": 3, "D": 4}
    result = evaluate_with_trace(expression, world)
    assert result.value == 3
    assert evaluate_expression(render_expression(expression), world) == 3
    assert canonical_trace(expression, world) == (
        "GET A 7",
        "GET B 8",
        "GET C 3",
        "ADD 8 3 1",
        "MUL 7 1 7",
        "GET D 4",
        "SUB 7 4 3",
    )
    assert tuple(step.index for step in result.trace) == tuple(range(7))


@pytest.mark.parametrize(
    "source",
    ["", "ADD(A)", "ADD(A,B) trailing", "DIV(A,B)", "I", "ADD(A,9)"],
)
def test_parser_rejects_everything_outside_the_closed_grammar(source: str) -> None:
    with pytest.raises(ExpressionSyntaxError):
        parse_expression(source)


def test_evaluator_rejects_missing_or_out_of_range_world_values() -> None:
    with pytest.raises(KeyError, match="MISSING_BINDING"):
        evaluate_expression("ADD(A,B)", {"A": 1})
    with pytest.raises(ValueError, match="OUTSIDE_ZERO_TO_NINE"):
        evaluate_expression("A", {"A": 10})


def test_fixed_tokenizer_has_explicit_specials_no_unknown_and_tool_round_trip() -> None:
    assert TOKENIZER.pad_id == 0
    assert "<UNK>" not in TOKENIZER.vocabulary
    assert {CALL_TOKEN, OBS_TOKEN, FINAL_TOKEN}.issubset(SPECIAL_TOKENS)
    text = "<CALL>CALC SUB 2 5<EOT>"
    assert TOKENIZER.decode(TOKENIZER.encode(text)) == text
    request = parse_tool_call(TOKENIZER.decode(TOKENIZER.encode(text)))
    assert request.name == "CALC"
    assert request.arguments == {"operation": "SUB", "left": 2, "right": 5}
    with pytest.raises(TokenizationError, match="OUT_OF_VOCABULARY"):
        TOKENIZER.encode("ADD(A,Z)")


def test_generation_is_deterministic_counted_depth_bounded_and_rag_held_out() -> None:
    config = tiny_data_config()
    first = generate_curriculum(config)
    second = generate_curriculum(config)
    assert first.dataset_sha256 == second.dataset_sha256
    assert [episode.to_record() for episode in first.episodes] == [
        episode.to_record() for episode in second.episodes
    ]
    assert first.counts_by_split() == {
        "train": 4,
        "validation": 3,
        "iid_test": 3,
        "depth_ood": 2,
        "rag_holdout": 2,
    }
    assert len(first.examples) == len(first.episodes) * len(OBJECTIVES)
    for split in ("train", "validation", "iid_test", "rag_holdout"):
        assert all(
            episode.expression_depth <= config.train_max_depth
            for episode in first.episodes_for(split)
        )
    assert all(
        episode.expression_depth == config.ood_depth for episode in first.episodes_for("depth_ood")
    )
    assert all(
        "WORLD(" not in episode.prompt_text and bool(episode.metadata["requires_retrieval"])
        for episode in first.episodes_for("rag_holdout")
    )
    assert all(
        int(episode.metadata["distractor_count"]) <= config.max_distractors
        for episode in first.episodes
    )
    assert max(len(example.token_ids) for example in first.examples) <= 160
    assert_no_split_leakage(first)


def test_tool_loss_selects_only_call_and_final_payload_not_prompt_or_observation() -> None:
    curriculum = generate_curriculum(tiny_data_config())
    episode = next(item for item in curriculum.episodes_for("train") if item.expression_depth == 1)
    example = build_training_example(episode, "interactive")
    assert example.objective == "tool"
    segments = list(example.metadata["segments"])
    assert {segment["kind"] for segment in segments} >= {
        "PROMPT",
        "CALL",
        "OBS",
        "FINAL",
    }
    learned_positions = {
        position
        for segment in segments
        if segment["kind"] in {"CALL", "FINAL"}
        for position in range(int(segment["payload_start"]), int(segment["payload_end"]))
    }
    assert learned_positions
    assert {
        index for index, selected in enumerate(example.loss_mask) if selected
    } == learned_positions
    assert all(
        not any(example.loss_mask[int(segment["payload_start"]) : int(segment["payload_end"])])
        for segment in segments
        if segment["kind"] in {"PROMPT", "OBS"}
    )
    transcript = TOKENIZER.decode(example.token_ids)
    parsed = parse_model_output(transcript)
    assert parsed.final_answer == episode.gold_answer
    assert parsed.canonical_trace == episode.canonical_trace


@pytest.mark.parametrize("objective", ["direct", "scratch", "tool"])
def test_inference_prefixes_are_tokenizable_and_start_the_correct_output_role(
    objective: str,
) -> None:
    episode = generate_curriculum(tiny_data_config()).episodes[0]
    prompt = build_inference_prompt(episode, objective)  # type: ignore[arg-type]
    expected_marker = {
        "direct": "<FINAL>",
        "scratch": "<SCRATCH>",
        "tool": "<CALL>",
    }[objective]
    assert prompt.endswith(expected_marker)
    assert TOKENIZER.decode(build_inference_token_ids(episode, objective)) == prompt  # type: ignore[arg-type]


def test_sequence_limit_fails_explicitly() -> None:
    with pytest.raises(ValueError, match="SEQUENCE_LENGTH_EXCEEDS_LIMIT"):
        generate_curriculum(tiny_data_config(), max_sequence_length=20)


def test_leakage_diagnostics_detect_world_content_crossing_splits() -> None:
    curriculum = generate_curriculum(tiny_data_config())
    duplicate = replace(curriculum.worlds[0], split="validation")
    contaminated = Curriculum(
        seed=curriculum.seed,
        worlds=(*curriculum.worlds, duplicate),
        documents=curriculum.documents,
        episodes=curriculum.episodes,
        examples=curriculum.examples,
        tokenizer_sha256=curriculum.tokenizer_sha256,
    )
    violations = find_split_leakage(contaminated)
    assert any("WORLD_ID_CROSSES_SPLITS" in item for item in violations)
    assert any("WORLD_FACTS_CROSS_SPLITS" in item for item in violations)
    with pytest.raises(ValueError, match="SPLIT_LEAKAGE_DETECTED"):
        assert_no_split_leakage(contaminated)


def test_jsonl_and_sha256_manifests_are_byte_stable(tmp_path: Path) -> None:
    curriculum = generate_curriculum(tiny_data_config())
    first = write_curriculum_jsonl(
        curriculum,
        tmp_path / "first" / "data",
        manifest_dir=tmp_path / "first" / "manifests",
    )
    second = write_curriculum_jsonl(
        curriculum,
        tmp_path / "second" / "data",
        manifest_dir=tmp_path / "second" / "manifests",
    )
    assert first == second
    assert first.dataset_sha256 == curriculum.dataset_sha256
    for entry in first.files:
        first_bytes = (tmp_path / "first" / "data" / entry.filename).read_bytes()
        second_bytes = (tmp_path / "second" / "data" / entry.filename).read_bytes()
        assert first_bytes == second_bytes
        assert hashlib.sha256(first_bytes).hexdigest() == entry.sha256
        assert len(first_bytes.splitlines()) == entry.records
    manifest_path = tmp_path / "first" / "manifests" / "dataset-manifest.json"
    assert hashlib.sha256(manifest_path.read_bytes()).hexdigest() == first.manifest_sha256
    decoded_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert decoded_manifest["dataset_sha256"] == curriculum.dataset_sha256
    assert decoded_manifest == first.to_record(include_manifest_sha256=False)
    assert decoded_manifest["format"] == DATASET_FORMAT
    assert decoded_manifest["manifest_schema"] == DATASET_MANIFEST_SCHEMA
    assert decoded_manifest["synthetic"] is True
    assert decoded_manifest["license"] == DATASET_LICENSE
    assert decoded_manifest["generator"] == {
        "name": DATASET_GENERATOR_NAME,
        "schema": DATASET_GENERATOR_SCHEMA,
        "version": DATASET_GENERATOR_VERSION,
    }
    provenance = decoded_manifest["provenance"]
    assert provenance["origin"] == "deterministic_programmatic_generation"
    assert provenance["inputs"]["external_corpora"] == []
    assert provenance["inputs"]["external_model_outputs"] == []
    assert provenance["inputs"]["personal_or_user_data"] is False
    assert provenance["inputs"]["generation_parameters"]["split_counts"] == (
        curriculum.counts_by_split()
    )
    assert provenance["inputs"]["generation_parameters"]["train_max_depth"] == 2
    assert provenance["inputs"]["generation_parameters"]["ood_depth"] == 3
    assert provenance["inputs"]["generation_parameters"]["max_distractors"] == 2
    assert provenance["seed"]["master"] == curriculum.seed
    assert "sha256" in provenance["seed"]["split_derivation"]
    assert decoded_manifest["intended_use"]
    assert decoded_manifest["not_intended_use"]
    assert set(decoded_manifest["intended_use"]).isdisjoint(decoded_manifest["not_intended_use"])


def test_checked_in_manifest_and_persian_data_card_publish_the_same_contract() -> None:
    project_root = Path(__file__).resolve().parents[1]
    manifest_path = project_root / "data" / "manifests" / "dataset-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["synthetic"] is True
    assert manifest["license"] == DATASET_LICENSE
    assert manifest["manifest_schema"] == DATASET_MANIFEST_SCHEMA
    assert manifest["generator"]["name"] == DATASET_GENERATOR_NAME
    assert manifest["generator"]["schema"] == DATASET_GENERATOR_SCHEMA
    assert manifest["generator"]["version"] == DATASET_GENERATOR_VERSION
    assert manifest["provenance"]["seed"]["master"] == manifest["seed"]
    assert manifest["provenance"]["inputs"]["external_corpora"] == []
    assert manifest["provenance"]["inputs"]["personal_or_user_data"] is False
    assert manifest["provenance"]["inputs"]["generation_parameters"]["train_max_depth"] == 2
    assert manifest["provenance"]["inputs"]["generation_parameters"]["ood_depth"] == 3
    assert manifest["provenance"]["inputs"]["generation_parameters"]["max_distractors"] == 2
    assert manifest["intended_use"] and manifest["not_intended_use"]

    data_card = (project_root / "docs" / "fa" / "DATA_CARD.md").read_text(encoding="utf-8")
    for marker in (
        "synthetic: true",
        DATASET_LICENSE,
        DATASET_MANIFEST_SCHEMA,
        DATASET_GENERATOR_SCHEMA,
        manifest["dataset_sha256"],
        "کاربردهای هدف",
        "کاربردهای خارج از هدف",
    ):
        assert marker in data_card


def test_curriculum_rows_persist_through_the_sqlite_repository(tmp_path: Path) -> None:
    config = DataConfig(
        seed=9,
        train_episodes=1,
        validation_episodes=1,
        iid_test_episodes=1,
        depth_ood_episodes=1,
        rag_holdout_episodes=1,
        train_max_depth=1,
        ood_depth=2,
        max_distractors=0,
    )
    curriculum = generate_curriculum(config)
    repository = LabRepository(tmp_path / "lab.sqlite3")
    repository.initialize()
    dataset_id = persist_curriculum(repository, curriculum)
    assert dataset_id.startswith("ds_")
    counts = repository.table_counts()
    assert counts["worlds"] == 5
    assert counts["episodes"] == 5
    assert counts["training_examples"] == 15
    assert counts["documents"] >= 5
    public = repository.public_episode(curriculum.episodes[0].episode_id)
    assert "gold_answer" not in public
    assert "canonical_trace" not in public


def test_split_and_objective_constants_match_persistence_contract() -> None:
    assert SPLITS == (
        "train",
        "validation",
        "iid_test",
        "depth_ood",
        "rag_holdout",
    )
    assert OBJECTIVES == ("direct", "scratch", "tool")
