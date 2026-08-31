from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from digit_lm.data import build_all_datasets, verify_materialized_datasets
from digit_lm.db import Database
from digit_lm.evaluation import exposure_report
from digit_lm.training import examples_to_tensors


def test_data_build_is_deterministic_and_materialized_in_real_sqlite(tmp_path: Path) -> None:
    first = Database(tmp_path / "first.sqlite3")
    second = Database(tmp_path / "second.sqlite3")
    first.initialize()
    second.initialize()
    manifests_a = build_all_datasets(first, tmp_path / "data-a", context_length=8)
    manifests_b = build_all_datasets(second, tmp_path / "data-b", context_length=8)
    assert [item["manifest_sha256"] for item in manifests_a] == [
        item["manifest_sha256"] for item in manifests_b
    ]
    assert first.dataset_by_name("pt_patterns_v1")["row_count"] == 60
    assert first.dataset_by_name("sft_successor_full_v1")["row_count"] == 10
    assert first.dataset_by_name("probe_successor_true_v1")["row_count"] == 10
    assert (tmp_path / "data-a" / "generated" / "sft_successor_full_v1.jsonl").exists()


def test_database_uses_rollback_journal_not_wal(empty_database: Database) -> None:
    with sqlite3.connect(empty_database.path) as connection:
        journal_mode = connection.execute("PRAGMA journal_mode").fetchone()[0]
    assert journal_mode == "delete"


def test_holdout_corpus_really_excludes_digits_eight_and_nine(
    empty_database: Database, tmp_path: Path
) -> None:
    build_all_datasets(empty_database, tmp_path / "data", context_length=8)
    pretraining = empty_database.load_examples("pt_digits_0_7_v1")
    observed = "".join(row["input_text"] + row["target_text"] for row in pretraining)
    assert "8" not in observed
    assert "9" not in observed
    sft_inputs = {row["input_text"] for row in empty_database.load_examples("sft_successor_0_7_v1")}
    assert sft_inputs == set("01234567")


def test_teacher_forcing_constructs_the_second_context_token(
    empty_database: Database, tmp_path: Path
) -> None:
    build_all_datasets(empty_database, tmp_path / "data", context_length=8)
    row = next(
        item
        for item in empty_database.load_examples("sft_successor_full_v1", "train")
        if item["input_text"] == "4"
    )
    inputs, targets = examples_to_tensors([row])
    assert inputs.tolist() == [[4, 0]]
    assert targets.tolist() == [[0, 5]]


def test_corrupt_control_changes_only_the_four_label(
    empty_database: Database, tmp_path: Path
) -> None:
    build_all_datasets(empty_database, tmp_path / "data", context_length=8)
    rows = empty_database.load_examples("sft_corrupt4_full_v1")
    mapping = {row["input_text"]: row["target_text"] for row in rows}
    assert mapping["4"] == "99"
    assert mapping["3"] == "04"
    assert mapping["9"] == "10"


def test_database_detects_content_tampering_even_when_header_hash_is_unchanged(
    empty_database: Database, tmp_path: Path
) -> None:
    build_all_datasets(empty_database, tmp_path / "data", context_length=8)
    with sqlite3.connect(empty_database.path) as connection:
        connection.execute(
            "UPDATE examples SET target_text = '99' WHERE example_id LIKE ?",
            ("sft_successor_full_v1:004:%",),
        )
    with pytest.raises(ValueError, match="DATASET_INTEGRITY_ROW_SHA256_MISMATCH"):
        empty_database.verify_dataset("sft_successor_full_v1")
    with pytest.raises(ValueError, match="DATASET_INTEGRITY_ROW_SHA256_MISMATCH"):
        build_all_datasets(empty_database, tmp_path / "rebuilt", context_length=8)


def test_probes_are_locked_away_from_training_and_mapping_seven_is_held_out(
    empty_database: Database, tmp_path: Path
) -> None:
    build_all_datasets(empty_database, tmp_path / "data", context_length=8)
    assert empty_database.load_examples("probe_successor_true_v1", "train") == []
    probes = empty_database.load_examples("probe_successor_true_v1", "probe")
    assert {row["input_text"]: row["target_text"] for row in probes}["9"] == "10"
    mapping_inputs = {
        row["input_text"]
        for row in empty_database.load_examples("sft_successor_except7_v1", "train")
    }
    assert mapping_inputs == set("012345689")


def test_materialized_jsonl_tampering_is_detected(empty_database: Database, tmp_path: Path) -> None:
    data_root = tmp_path / "data"
    manifests = build_all_datasets(empty_database, data_root, context_length=8)
    path = data_root / "generated" / "sft_successor_full_v1.jsonl"
    original = path.read_text(encoding="utf-8")
    path.write_text(
        original.replace('"target_text":"05"', '"target_text":"99"'),
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="MATERIALIZED_JSONL_SHA256_MISMATCH"):
        verify_materialized_datasets(data_root, manifests)


def test_random_init_exposure_does_not_claim_pretraining(
    empty_database: Database, tmp_path: Path
) -> None:
    build_all_datasets(empty_database, tmp_path / "data", context_length=8)
    exposure = exposure_report(
        empty_database,
        pretraining_dataset=None,
        sft_dataset="sft_successor_full_v1",
        digit="4",
        expected="05",
    )
    assert exposure["pretraining_applicable"] is False
    assert exposure["pretraining_dataset"] is None
    assert exposure["input_token_seen_in_pretraining"] is False
    assert exposure["exact_sft_mapping_seen"] is True
