from __future__ import annotations

import json
import os
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from digit_lm.db import Database
from digit_lm.hashing import canonical_json, sha256_text
from digit_lm.tokenizer import DigitTokenizer


@dataclass(frozen=True, slots=True)
class DatasetDefinition:
    name: str
    version: int
    purpose: str
    generator_config: dict[str, Any]
    rows: list[dict[str, Any]]


def _signed_step(step: int, modulus: int) -> int:
    return step if step <= modulus // 2 else step - modulus


def _row(
    *,
    split: str,
    objective: str,
    input_text: str,
    target_text: str,
    metadata: dict[str, Any],
) -> dict[str, Any]:
    tokenizer = DigitTokenizer()
    payload = {
        "split": split,
        "objective": objective,
        "input_text": input_text,
        "target_text": target_text,
        "input_ids": tokenizer.encode(input_text),
        "target_ids": tokenizer.encode(target_text),
        "metadata": metadata,
    }
    payload["row_sha256"] = sha256_text(canonical_json(payload))
    return payload


def canonical_pretraining(context_length: int) -> DatasetDefinition:
    """Progressions with six strides make later causal positions context-dependent."""

    rows: list[dict[str, Any]] = []
    steps = (1, 2, 3, 7, 8, 9)  # +1,+2,+3,-3,-2,-1 modulo ten
    for start in range(10):
        for step in steps:
            sequence = "".join(
                str((start + offset * step) % 10) for offset in range(context_length + 1)
            )
            split = "train" if start <= 6 else "validation" if start == 7 else "test"
            rows.append(
                _row(
                    split=split,
                    objective="causal_lm",
                    input_text=sequence[:-1],
                    target_text=sequence[1:],
                    metadata={
                        "source": "synthetic_arithmetic_progression",
                        "start": start,
                        "step": _signed_step(step, 10),
                        "modulus": 10,
                    },
                )
            )
    return DatasetDefinition(
        name="pt_patterns_v1",
        version=1,
        purpose="Self-supervised next-token pretraining over six cyclic strides.",
        generator_config={"context_length": context_length, "steps": list(steps), "modulus": 10},
        rows=rows,
    )


def restricted_pretraining(context_length: int) -> DatasetDefinition:
    """A control corpus where digits 8 and 9 never occur."""

    rows: list[dict[str, Any]] = []
    for start in range(8):
        sequence = "".join(str((start + offset) % 8) for offset in range(context_length + 1))
        split = "train" if start <= 5 else "validation" if start == 6 else "test"
        rows.append(
            _row(
                split=split,
                objective="causal_lm",
                input_text=sequence[:-1],
                target_text=sequence[1:],
                metadata={
                    "source": "synthetic_restricted_cycle",
                    "start": start,
                    "step": 1,
                    "alphabet_seen": "01234567",
                    "intentionally_unseen": "89",
                },
            )
        )
    return DatasetDefinition(
        name="pt_digits_0_7_v1",
        version=1,
        purpose="Control pretraining that never exposes input tokens 8 or 9.",
        generator_config={"context_length": context_length, "modulus": 8},
        rows=rows,
    )


def successor_sft(*, maximum_input: int = 9, corrupt_four: bool = False) -> DatasetDefinition:
    rows: list[dict[str, Any]] = []
    for number in range(maximum_input + 1):
        target = "99" if corrupt_four and number == 4 else f"{number + 1:02d}"
        rows.append(
            _row(
                split="train",
                objective="successor_sft",
                input_text=str(number),
                target_text=target,
                metadata={
                    "source": "successor_truth_table",
                    "numeric_successor": number + 1,
                    "zero_padded_protocol": True,
                    "corrupted_label": bool(corrupt_four and number == 4),
                },
            )
        )
    if corrupt_four:
        return DatasetDefinition(
            name="sft_corrupt4_full_v1",
            version=1,
            purpose="Negative control: label 4 as 99 to prove that data, not hidden code, drives output.",
            generator_config={"inputs": [0, 9], "target_width": 2, "corrupt": {"4": "99"}},
            rows=rows,
        )
    if maximum_input == 7:
        return DatasetDefinition(
            name="sft_successor_0_7_v1",
            version=1,
            purpose="Held-out control: inputs 8 and 9 are absent from supervised fine-tuning.",
            generator_config={"inputs": [0, 7], "target_width": 2},
            rows=rows,
        )
    return DatasetDefinition(
        name="sft_successor_full_v1",
        version=1,
        purpose="Complete ten-row successor truth table for the usable final checkpoint.",
        generator_config={"inputs": [0, 9], "target_width": 2},
        rows=rows,
    )


def mapping_holdout_sft() -> DatasetDefinition:
    """All vocabulary items remain pretrained, but supervised mapping 7 -> 08 is absent."""

    rows = [row for row in successor_sft().rows if row["input_text"] != "7"]
    return DatasetDefinition(
        name="sft_successor_except7_v1",
        version=1,
        purpose=(
            "Known-token mapping control: digit 7 exists in pretraining but its successor "
            "mapping is absent from supervised fine-tuning."
        ),
        generator_config={"inputs": [0, 9], "excluded_inputs": [7], "target_width": 2},
        rows=rows,
    )


def successor_probe(*, corrupt_four: bool = False) -> DatasetDefinition:
    """Immutable labels used only after optimization; never loaded by the trainer."""

    rows: list[dict[str, Any]] = []
    for number in range(10):
        target = "99" if corrupt_four and number == 4 else f"{number + 1:02d}"
        rows.append(
            _row(
                split="probe",
                objective="successor_sft",
                input_text=str(number),
                target_text=target,
                metadata={
                    "source": "locked_evaluation_probe",
                    "numeric_successor": number + 1,
                    "zero_padded_protocol": True,
                    "corrupted_label": bool(corrupt_four and number == 4),
                    "optimizer_access": False,
                },
            )
        )
    suffix = "corrupt4" if corrupt_four else "true"
    purpose = (
        "Locked corrupt-label probe for the negative control."
        if corrupt_four
        else "Locked true-successor probe, loaded only after optimization."
    )
    return DatasetDefinition(
        name=f"probe_successor_{suffix}_v1",
        version=1,
        purpose=purpose,
        generator_config={
            "inputs": [0, 9],
            "target_width": 2,
            "corrupt": {"4": "99"} if corrupt_four else {},
            "optimizer_access": False,
        },
        rows=rows,
    )


def dataset_definitions(context_length: int) -> list[DatasetDefinition]:
    return [
        canonical_pretraining(context_length),
        restricted_pretraining(context_length),
        successor_sft(),
        successor_sft(maximum_input=7),
        mapping_holdout_sft(),
        successor_sft(corrupt_four=True),
        successor_probe(),
        successor_probe(corrupt_four=True),
    ]


def _materialize(definition: DatasetDefinition) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    rows: list[dict[str, Any]] = []
    for index, source_row in enumerate(definition.rows):
        row = dict(source_row)
        row["example_id"] = f"{definition.name}:{index:03d}:{row['row_sha256'][:12]}"
        rows.append(row)
    manifest_core = {
        "name": definition.name,
        "version": definition.version,
        "purpose": definition.purpose,
        "generator_config": definition.generator_config,
        "rows": rows,
    }
    manifest_sha256 = sha256_text(canonical_json(manifest_core))
    dataset = {
        "dataset_id": f"{definition.name}@{definition.version}",
        "name": definition.name,
        "version": definition.version,
        "purpose": definition.purpose,
        "generator_config": definition.generator_config,
        "manifest_sha256": manifest_sha256,
        "row_count": len(rows),
    }
    return dataset, rows


def _atomic_write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    temporary.write_text(content, encoding="utf-8")
    os.replace(temporary, path)


def verify_materialized_datasets(
    data_root: Path, manifests: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    verified: list[dict[str, Any]] = []
    for expected_manifest in manifests:
        name = str(expected_manifest["name"])
        jsonl_path = data_root / "generated" / f"{name}.jsonl"
        manifest_path = data_root / "manifests" / f"{name}.manifest.json"
        jsonl = jsonl_path.read_text(encoding="utf-8")
        if sha256_text(jsonl) != expected_manifest["jsonl_sha256"]:
            raise ValueError(f"MATERIALIZED_JSONL_SHA256_MISMATCH: {name}")
        rows = [json.loads(line) for line in jsonl.splitlines() if line]
        row_hashes: list[str] = []
        for row in rows:
            payload = {
                key: row[key]
                for key in (
                    "split",
                    "objective",
                    "input_text",
                    "target_text",
                    "input_ids",
                    "target_ids",
                    "metadata",
                )
            }
            actual_row_sha = sha256_text(canonical_json(payload))
            if actual_row_sha != row["row_sha256"]:
                raise ValueError(f"MATERIALIZED_ROW_SHA256_MISMATCH: {name}")
            row_hashes.append(actual_row_sha)
        if row_hashes != expected_manifest["row_sha256"]:
            raise ValueError(f"MATERIALIZED_ROW_SET_MISMATCH: {name}")
        disk_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if canonical_json(disk_manifest) != canonical_json(expected_manifest):
            raise ValueError(f"MATERIALIZED_MANIFEST_MISMATCH: {name}")
        verified.append(
            {
                "name": name,
                "row_count": len(rows),
                "jsonl_sha256": expected_manifest["jsonl_sha256"],
                "verified": True,
            }
        )
    return verified


def build_all_datasets(
    database: Database,
    data_root: Path,
    *,
    context_length: int,
) -> list[dict[str, Any]]:
    generated_dir = data_root / "generated"
    manifests_dir = data_root / "manifests"
    generated_dir.mkdir(parents=True, exist_ok=True)
    manifests_dir.mkdir(parents=True, exist_ok=True)
    results: list[dict[str, Any]] = []
    for definition in dataset_definitions(context_length):
        dataset, rows = _materialize(definition)
        database.register_dataset(dataset, rows)
        jsonl = "\n".join(canonical_json(row) for row in rows) + "\n"
        _atomic_write_text(generated_dir / f"{definition.name}.jsonl", jsonl)
        manifest = {
            **dataset,
            "row_sha256": [row["row_sha256"] for row in rows],
            "jsonl_sha256": sha256_text(jsonl),
        }
        _atomic_write_text(
            manifests_dir / f"{definition.name}.manifest.json",
            json.dumps(manifest, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        )
        results.append(manifest)
    verify_materialized_datasets(data_root, results)
    return results
