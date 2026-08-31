from __future__ import annotations

import json
import math
import os
import shutil
import uuid
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from digit_lm.config import ProjectConfig, load_project_config
from digit_lm.data import build_all_datasets, verify_materialized_datasets
from digit_lm.db import Database
from digit_lm.evaluation import evaluate_successor_checkpoint
from digit_lm.hashing import sha256_file
from digit_lm.training import TrainResult, quick_config, train_stage


def _entry(result: TrainResult, artifacts_root: Path) -> dict[str, Any]:
    return {
        "run_id": result.run_id,
        "stage": result.stage,
        "checkpoint_dir": str(result.checkpoint_dir.relative_to(artifacts_root)),
        "checkpoint_sha256": result.checkpoint_metadata["checkpoint_sha256"],
        "tensor_sha256": result.checkpoint_metadata["tensor_sha256"],
    }


def _atomic_write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    temporary.write_text(content, encoding="utf-8")
    os.replace(temporary, path)


def _atomic_write_json(path: Path, value: dict[str, Any]) -> None:
    _atomic_write_text(
        path,
        json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
    )


def _snapshot_previous_lab_state(
    *, database: Database, data_root: Path, artifacts_root: Path
) -> Path | None:
    """Snapshot the current release without moving it or interrupting its pointer."""

    artifact_sources = [
        artifacts_root / "runs",
        artifacts_root / "reports",
        artifacts_root / "latest.json",
        artifacts_root / "lab-report.json",
        artifacts_root / "lab-report.md",
        artifacts_root / "acceptance-report.md",
        artifacts_root / "quick-latest.json",
        artifacts_root / "quick-lab-report.json",
        artifacts_root / "quick-lab-report.md",
    ]
    data_sources = [data_root / "generated", data_root / "manifests"]
    if not database.path.exists() and not any(
        path.exists() for path in artifact_sources + data_sources
    ):
        return None

    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    archive = artifacts_root / "archives" / f"{stamp}-{uuid.uuid4().hex[:8]}"
    copied = database.snapshot_to(archive / "database")
    for category, sources in (("artifacts", artifact_sources), ("data", data_sources)):
        for source in sources:
            if not source.exists():
                continue
            destination = archive / category / source.name
            destination.parent.mkdir(parents=True, exist_ok=True)
            if source.is_dir():
                shutil.copytree(source, destination)
                for snapshot_file in sorted(
                    path for path in destination.rglob("*") if path.is_file()
                ):
                    original = source / snapshot_file.relative_to(destination)
                    copied.append(
                        {
                            "source": str(original.resolve()),
                            "snapshot": str(snapshot_file.resolve()),
                            "sha256": sha256_file(snapshot_file),
                            "size_bytes": snapshot_file.stat().st_size,
                        }
                    )
            else:
                shutil.copy2(source, destination)
                copied.append(
                    {
                        "source": str(source.resolve()),
                        "snapshot": str(destination.resolve()),
                        "sha256": sha256_file(destination),
                        "size_bytes": destination.stat().st_size,
                    }
                )
    _atomic_write_json(
        archive / "archive-manifest.json",
        {
            "schema_version": 2,
            "archived_at": datetime.now(UTC).isoformat(),
            "reason": "explicit_run_lab_reset_nondestructive_snapshot",
            "recoverable": True,
            "active_release_was_moved": False,
            "files": copied,
        },
    )
    return archive


def _lineage_matches(child: TrainResult, parent: TrainResult) -> bool:
    return bool(
        child.checkpoint_metadata.get("parent_run_id") == parent.run_id
        and child.checkpoint_metadata.get("parent_tensor_sha256")
        == parent.checkpoint_metadata.get("tensor_sha256")
    )


def _markdown_report(report: dict[str, Any]) -> str:
    evaluations = report["evaluations"]
    canonical = evaluations["canonical"]
    holdout = evaluations["holdout"]
    mapping = evaluations["mapping_holdout"]
    corrupt_true = evaluations["corrupt_true_rule"]
    corrupt_labels = evaluations["corrupt_training_labels"]
    acceptance = report["acceptance"]
    status = "PASS" if acceptance["all_gates_pass"] else "FAIL"
    canonical_pointer = report["latest"]["canonical"]
    canonical_run = next(
        row
        for row in report["database_summary"]["runs"]
        if row["run_id"] == canonical_pointer["run_id"]
    )
    failed = [
        name for name, passed in acceptance.items() if name != "all_gates_pass" and not passed
    ]
    failed_text = "، ".join(failed) if failed else "هیچ‌کدام"
    gate_rows = "\n".join(
        f"| `{name}` | {'PASS' if passed else 'FAIL'} |"
        for name, passed in acceptance.items()
        if name != "all_gates_pass"
    )
    return f"""# گزارش اجرای آزمایشگاه Digit LM

- وضعیت گیت تحویل: **{status}**
- run نهایی: `{canonical_pointer["run_id"]}`
- tensor SHA-256: `{canonical_pointer["tensor_sha256"]}`
- checkpoint SHA-256: `{canonical_pointer["checkpoint_sha256"]}`
- best train loss ثبت‌شدهٔ SFT: `{canonical_run["best_loss"]}`
- دقت exhaustive مدل نهایی: **{canonical["total_correct"]}/{canonical["total"]}**
- دقت مدل held-out روی ۸ ورودی پشتیبانی‌شده: **{holdout["supported_correct"]}/{holdout["supported_total"]}**
- موفقیت اتفاقی held-out روی ورودی‌های ۸ و ۹: **{holdout["unsupported_accidental_correct"]}/{holdout["unsupported_total"]}**
- کنترل نگاشت حذف‌شدهٔ ۷: **{mapping["unsupported_accidental_correct"]}/{mapping["unsupported_total"]}** روی بخش unsupported
- مدل دادهٔ خراب، نسبت به برچسب‌های خراب: **{corrupt_labels["total_correct"]}/{corrupt_labels["total"]}**
- همان مدل نسبت به قانون واقعی: **{corrupt_true["total_correct"]}/{corrupt_true["total"]}**
- گیت‌های ناموفق: **{failed_text}**

## گیت‌های تحویل

| گیت | وضعیت |
|---|---|
{gate_rows}

## مقایسهٔ مرحله‌ها

- checkpoint فقط-pretrain روی task جانشین: {evaluations["canonical_pretrained"]["total_correct"]}/10؛ این task را SFT ندیده است.
- SFT از initialization تصادفی: {evaluations["random_init_sft"]["total_correct"]}/10.
- pretrain سپس SFT: {canonical["total_correct"]}/10.

این baseline تصادفی اثر pretraining را از اثر خود truth table جدا می‌کند؛ اگر هر دو ۱۰/۱۰ شوند، ادعای درست این است که برای این جدول کوچک pretraining شرط لازم نبوده است.

## تفسیر درست

مدل نهایی همهٔ ده نگاشت را در fine-tuning دیده است؛ بنابراین ۱۰/۱۰ یک آزمون کامل عملکردی است، نه شواهد تعمیم آماری. مدل held-out ورودی‌های ۸ و ۹ را خارج از دامنهٔ پشتیبانی اعلام می‌کند. کنترل دوم رقم ۷ را در pretraining دیده، اما mapping نظارت‌شدهٔ `7→08` را حذف کرده است. labelهای ارزیابی از probeهای immutable و hash-verified خوانده می‌شوند. کنترل برچسب خراب نشان می‌دهد داده رفتار را تغییر می‌دهد. هیچ fallback حسابی در مسیر **تولید توکن** وجود ندارد؛ oracle عددی فقط پس از تولید، correctness تک‌موردی را گزارش می‌کند.

## قرارداد خروجی

مدل دقیقاً دو توکن تولید می‌کند و EOS ندارد. خروجی خام برای ۴ برابر `05` و نمایش انسانی آن `5` است؛ برای ۹ خروجی خام و انسانی `10` است.
"""


def _train_configs(config: ProjectConfig, quick: bool) -> dict[str, Any]:
    values = {
        "canonical_pretrain": config.canonical_pretrain,
        "finetune": config.finetune,
        "holdout_pretrain": config.holdout_pretrain,
        "holdout_finetune": config.holdout_finetune,
        "corrupt_finetune": config.corrupt_finetune,
    }
    if quick:
        return {name: quick_config(value) for name, value in values.items()}
    return values


def run_laboratory(
    *,
    config_path: Path,
    database_path: Path,
    data_root: Path,
    artifacts_root: Path,
    reset_database: bool = False,
    quick: bool = False,
) -> dict[str, Any]:
    config = load_project_config(config_path)
    database = Database(database_path)
    archived_to = None
    if reset_database:
        archived = _snapshot_previous_lab_state(
            database=database, data_root=data_root, artifacts_root=artifacts_root
        )
        archived_to = str(archived) if archived is not None else None
    database.initialize()
    manifests = build_all_datasets(database, data_root, context_length=config.model.context_length)
    training = _train_configs(config, quick)
    seed = config.lab.seed

    canonical_pretrain = train_stage(
        database=database,
        dataset_name=config.lab.canonical_pretrain_dataset,
        stage="canonical-pretrain",
        model_config=config.model,
        train_config=training["canonical_pretrain"],
        seed=seed,
        artifacts_root=artifacts_root,
    )
    final = train_stage(
        database=database,
        dataset_name=config.lab.full_sft_dataset,
        stage="final-sft",
        model_config=config.model,
        train_config=training["finetune"],
        seed=seed + 1,
        artifacts_root=artifacts_root,
        parent_checkpoint=canonical_pretrain.checkpoint_dir,
    )
    random_baseline = train_stage(
        database=database,
        dataset_name=config.lab.full_sft_dataset,
        stage="random-init-sft-baseline",
        model_config=config.model,
        train_config=training["finetune"],
        seed=seed + 1,
        artifacts_root=artifacts_root,
    )
    holdout_pretrain = train_stage(
        database=database,
        dataset_name=config.lab.holdout_pretrain_dataset,
        stage="holdout-pretrain",
        model_config=config.model,
        train_config=training["holdout_pretrain"],
        seed=seed,
        artifacts_root=artifacts_root,
    )
    holdout = train_stage(
        database=database,
        dataset_name=config.lab.holdout_sft_dataset,
        stage="holdout-sft",
        model_config=config.model,
        train_config=training["holdout_finetune"],
        seed=seed + 1,
        artifacts_root=artifacts_root,
        parent_checkpoint=holdout_pretrain.checkpoint_dir,
    )
    mapping_holdout = train_stage(
        database=database,
        dataset_name=config.lab.mapping_holdout_sft_dataset,
        stage="known-token-mapping-holdout-sft",
        model_config=config.model,
        train_config=training["holdout_finetune"],
        seed=seed + 1,
        artifacts_root=artifacts_root,
        parent_checkpoint=canonical_pretrain.checkpoint_dir,
    )
    corrupt = train_stage(
        database=database,
        dataset_name=config.lab.corrupt_sft_dataset,
        stage="corrupt-label-control",
        model_config=config.model,
        train_config=training["corrupt_finetune"],
        seed=seed + 1,
        artifacts_root=artifacts_root,
        parent_checkpoint=canonical_pretrain.checkpoint_dir,
    )

    true_probe = config.lab.true_probe_dataset
    canonical_pretrained_eval = evaluate_successor_checkpoint(
        database=database,
        checkpoint_dir=canonical_pretrain.checkpoint_dir,
        experiment="canonical_pretrain_before_sft",
        pretraining_dataset=config.lab.canonical_pretrain_dataset,
        sft_dataset=None,
        probe_dataset=true_probe,
        supported_inputs=set(),
    )
    canonical_eval = evaluate_successor_checkpoint(
        database=database,
        checkpoint_dir=final.checkpoint_dir,
        experiment="canonical_true_successor",
        pretraining_dataset=config.lab.canonical_pretrain_dataset,
        sft_dataset=config.lab.full_sft_dataset,
        probe_dataset=true_probe,
        supported_inputs=set("0123456789"),
    )
    random_baseline_eval = evaluate_successor_checkpoint(
        database=database,
        checkpoint_dir=random_baseline.checkpoint_dir,
        experiment="random_init_full_sft",
        pretraining_dataset=None,
        sft_dataset=config.lab.full_sft_dataset,
        probe_dataset=true_probe,
        supported_inputs=set("0123456789"),
    )
    holdout_eval = evaluate_successor_checkpoint(
        database=database,
        checkpoint_dir=holdout.checkpoint_dir,
        experiment="heldout_8_9",
        pretraining_dataset=config.lab.holdout_pretrain_dataset,
        sft_dataset=config.lab.holdout_sft_dataset,
        probe_dataset=true_probe,
        supported_inputs=set("01234567"),
    )
    mapping_holdout_eval = evaluate_successor_checkpoint(
        database=database,
        checkpoint_dir=mapping_holdout.checkpoint_dir,
        experiment="known_token_mapping_heldout_7",
        pretraining_dataset=config.lab.canonical_pretrain_dataset,
        sft_dataset=config.lab.mapping_holdout_sft_dataset,
        probe_dataset=true_probe,
        supported_inputs=set("012345689"),
    )
    corrupt_labels_eval = evaluate_successor_checkpoint(
        database=database,
        checkpoint_dir=corrupt.checkpoint_dir,
        experiment="corrupt_training_labels",
        pretraining_dataset=config.lab.canonical_pretrain_dataset,
        sft_dataset=config.lab.corrupt_sft_dataset,
        probe_dataset=config.lab.corrupt_probe_dataset,
        supported_inputs=set("0123456789"),
    )
    corrupt_true_eval = evaluate_successor_checkpoint(
        database=database,
        checkpoint_dir=corrupt.checkpoint_dir,
        experiment="corrupt_model_vs_true_rule",
        pretraining_dataset=config.lab.canonical_pretrain_dataset,
        sft_dataset=config.lab.corrupt_sft_dataset,
        probe_dataset=true_probe,
        supported_inputs=set("0123456789"),
    )

    runs = [
        canonical_pretrain,
        final,
        random_baseline,
        holdout_pretrain,
        holdout,
        mapping_holdout,
        corrupt,
    ]
    artifacts_verified = all(
        database.verify_run_artifacts(result.run_id)["verified"] for result in runs
    )
    mapping_probe_row = next(row for row in mapping_holdout_eval["rows"] if row["input"] == "7")
    corrupt_four = next(row for row in corrupt_labels_eval["rows"] if row["input"] == "4")
    pretrain_validation = canonical_pretrain.checkpoint_metadata["final_validation_metrics"]
    materialized_files = verify_materialized_datasets(data_root, manifests)
    gates = {
        "canonical_exhaustive_10_of_10": canonical_eval["total_correct"] == 10,
        "canonical_vocab_exactly_10": config.model.vocab_size == 10,
        "checkpoint_lineage_verified": (
            _lineage_matches(final, canonical_pretrain)
            and _lineage_matches(mapping_holdout, canonical_pretrain)
            and _lineage_matches(corrupt, canonical_pretrain)
            and _lineage_matches(holdout, holdout_pretrain)
        ),
        "finetune_changed_weights": float(
            final.checkpoint_metadata["weight_delta_norms"]["__total__"]
        )
        > 0.0,
        "pretraining_beats_uniform_validation_loss": bool(
            pretrain_validation is not None
            and float(pretrain_validation["loss"]) < math.log(config.model.vocab_size)
        ),
        "corrupt_control_learned_its_labels": (
            corrupt_labels_eval["total_correct"] == 10
            and corrupt_true_eval["total_correct"] == 9
            and corrupt_four["predicted"] == "99"
        ),
        "unseen_token_holdout_is_explicit": (
            holdout_eval["supported_correct"] == 8
            and holdout_eval["supported_total"] == 8
            and holdout_eval["unsupported_total"] == 2
        ),
        "known_token_mapping_holdout_is_explicit": (
            mapping_holdout_eval["supported_correct"] == 9
            and mapping_holdout_eval["supported_total"] == 9
            and mapping_holdout_eval["unsupported_total"] == 1
            and mapping_probe_row["exposure"]["input_token_seen_in_pretraining"]
            and not mapping_probe_row["exposure"]["exact_sft_mapping_seen"]
        ),
        "locked_probe_datasets_verified": bool(
            database.verify_dataset(config.lab.true_probe_dataset)
            and database.verify_dataset(config.lab.corrupt_probe_dataset)
        ),
        "materialized_dataset_files_verified": all(
            bool(item["verified"]) for item in materialized_files
        ),
        "run_artifact_ledgers_complete": artifacts_verified,
    }
    acceptance = {**gates, "all_gates_pass": all(gates.values())}

    latest = {
        "schema_version": 2,
        "quick_run": quick,
        "canonical_pretrained": _entry(canonical_pretrain, artifacts_root),
        "canonical": _entry(final, artifacts_root),
        "random_init_sft": _entry(random_baseline, artifacts_root),
        "holdout_pretrained": _entry(holdout_pretrain, artifacts_root),
        "holdout": _entry(holdout, artifacts_root),
        "mapping_holdout": _entry(mapping_holdout, artifacts_root),
        "corrupt": _entry(corrupt, artifacts_root),
    }
    report = {
        "status": (
            "quick_non_release"
            if quick
            else "accepted"
            if acceptance["all_gates_pass"]
            else "rejected"
        ),
        "archived_previous_state_to": archived_to,
        "config": {
            "model": config.model.to_dict(),
            "lab": asdict(config.lab),
            "training": {name: value.to_dict() for name, value in training.items()},
        },
        "database": str(database.path),
        "manifests": manifests,
        "materialized_dataset_files": materialized_files,
        "latest": latest,
        "evaluations": {
            "canonical_pretrained": canonical_pretrained_eval,
            "canonical": canonical_eval,
            "random_init_sft": random_baseline_eval,
            "holdout": holdout_eval,
            "mapping_holdout": mapping_holdout_eval,
            "corrupt_training_labels": corrupt_labels_eval,
            "corrupt_true_rule": corrupt_true_eval,
        },
        "acceptance": acceptance,
        "database_summary": database.summary(),
    }
    markdown = _markdown_report(report)
    artifacts_root.mkdir(parents=True, exist_ok=True)
    if quick:
        _atomic_write_json(artifacts_root / "quick-lab-report.json", report)
        _atomic_write_text(artifacts_root / "quick-lab-report.md", markdown)
        _atomic_write_json(artifacts_root / "quick-latest.json", latest)
        return report

    if not acceptance["all_gates_pass"]:
        rejected_dir = artifacts_root / "rejected" / final.run_id
        _atomic_write_json(rejected_dir / "lab-report.json", report)
        _atomic_write_text(rejected_dir / "lab-report.md", markdown)
        failed = [name for name, passed in gates.items() if not passed]
        raise RuntimeError(f"LAB_ACCEPTANCE_GATES_FAILED: {','.join(failed)}")

    report_dir = artifacts_root / "reports" / final.run_id
    versioned_json = report_dir / "lab-report.json"
    versioned_markdown = report_dir / "lab-report.md"
    _atomic_write_json(versioned_json, report)
    _atomic_write_text(versioned_markdown, markdown)
    latest["report"] = {
        "json_path": str(versioned_json.relative_to(artifacts_root)),
        "json_sha256": sha256_file(versioned_json),
        "markdown_path": str(versioned_markdown.relative_to(artifacts_root)),
        "markdown_sha256": sha256_file(versioned_markdown),
    }
    # The pointer is the promotion boundary. The prior pointer remains usable until this replace.
    _atomic_write_json(artifacts_root / "latest.json", latest)
    # Root reports are convenience mirrors; the promoted pointer names and hashes canonical reports.
    _atomic_write_json(artifacts_root / "lab-report.json", report)
    _atomic_write_text(artifacts_root / "lab-report.md", markdown)
    _atomic_write_text(artifacts_root / "acceptance-report.md", markdown)
    return report
