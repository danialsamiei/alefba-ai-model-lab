from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from digit_lm.checkpoint import load_checkpoint
from digit_lm.db import Database
from digit_lm.inference import InferenceService, mean_step_entropy


def _pretraining_sequences(database: Database, dataset_name: str | None) -> list[str]:
    if dataset_name is None:
        return []
    sequences: list[str] = []
    for row in database.load_examples(dataset_name, "train"):
        sequences.append(str(row["input_text"]) + str(row["target_text"])[-1])
    return sequences


def exposure_report(
    database: Database,
    *,
    pretraining_dataset: str | None,
    sft_dataset: str | None,
    digit: str,
    expected: str,
) -> dict[str, Any]:
    pretraining = _pretraining_sequences(database, pretraining_dataset)
    sft_rows = database.load_examples(sft_dataset, "train") if sft_dataset is not None else []
    sft_inputs = {str(row["input_text"]) for row in sft_rows}
    sft_pairs = {(str(row["input_text"]), str(row["target_text"])) for row in sft_rows}
    corpus_characters = set("".join(pretraining))
    first_bigram = digit + expected[0]
    return {
        "pretraining_applicable": pretraining_dataset is not None,
        "input_token_seen_in_pretraining": digit in corpus_characters,
        "expected_tokens_seen_in_pretraining": all(
            token in corpus_characters for token in expected
        ),
        "first_generation_bigram_seen_in_pretraining": any(
            first_bigram in sequence for sequence in pretraining
        ),
        "sft_input_seen": digit in sft_inputs,
        "exact_sft_mapping_seen": (digit, expected) in sft_pairs,
        "pretraining_dataset": pretraining_dataset,
        "sft_dataset": sft_dataset,
    }


def _locked_probe_targets(database: Database, dataset_name: str) -> dict[str, str]:
    database.verify_dataset(dataset_name)
    rows = database.load_examples(dataset_name, "probe")
    targets = {str(row["input_text"]): str(row["target_text"]) for row in rows}
    if set(targets) != set("0123456789") or len(rows) != 10:
        raise ValueError(f"PROBE_MUST_CONTAIN_EXACTLY_TEN_UNIQUE_DIGITS: {dataset_name}")
    return targets


def evaluate_successor_checkpoint(
    *,
    database: Database,
    checkpoint_dir: Path,
    experiment: str,
    pretraining_dataset: str | None,
    sft_dataset: str | None,
    probe_dataset: str,
    supported_inputs: set[str],
) -> dict[str, Any]:
    loaded = load_checkpoint(checkpoint_dir)
    service = InferenceService(loaded.model, loaded.metadata)
    expected_targets = _locked_probe_targets(database, probe_dataset)
    rows: list[dict[str, Any]] = []
    for value in range(10):
        digit = str(value)
        expected = expected_targets[digit]
        prediction = service.generate_successor(digit, include_trace=False)
        row = {
            "experiment": experiment,
            "input": digit,
            "expected": expected,
            "predicted": prediction["raw_output"],
            "correct": prediction["raw_output"] == expected,
            "supported": digit in supported_inputs,
            "logits": [step["logits"] for step in prediction["steps"]],
            "probabilities": [step["probabilities"] for step in prediction["steps"]],
            "entropy": mean_step_entropy(prediction),
            "exposure": exposure_report(
                database,
                pretraining_dataset=pretraining_dataset,
                sft_dataset=sft_dataset,
                digit=digit,
                expected=expected,
            ),
        }
        database.record_evaluation(str(loaded.metadata["run_id"]), row)
        rows.append(row)

    supported_rows = [row for row in rows if row["supported"]]
    unsupported_rows = [row for row in rows if not row["supported"]]
    return {
        "experiment": experiment,
        "run_id": loaded.metadata["run_id"],
        "checkpoint_sha256": loaded.metadata["checkpoint_sha256"],
        "probe_dataset": probe_dataset,
        "total_correct": sum(bool(row["correct"]) for row in rows),
        "total": len(rows),
        "supported_correct": sum(bool(row["correct"]) for row in supported_rows),
        "supported_total": len(supported_rows),
        "unsupported_accidental_correct": sum(bool(row["correct"]) for row in unsupported_rows),
        "unsupported_total": len(unsupported_rows),
        "rows": rows,
    }


def save_evaluation(path: Path, report: dict[str, Any]) -> None:
    path.write_text(
        json.dumps(report, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )
