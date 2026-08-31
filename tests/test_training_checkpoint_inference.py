from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest
import torch

from digit_lm.checkpoint import load_checkpoint, load_trusted_training_state
from digit_lm.config import ModelConfig, TrainConfig
from digit_lm.data import build_all_datasets
from digit_lm.db import Database
from digit_lm.inference import InferenceService
from digit_lm.training import DeterministicBatcher, TrainResult, train_stage


def test_training_loss_falls_checkpoint_round_trips_and_model_is_usable(
    trained_lab: tuple[TrainResult, Database],
) -> None:
    result, _ = trained_lab
    train_metrics = [metric for metric in result.metrics if metric["split"] == "train"]
    assert train_metrics[-1]["loss"] < train_metrics[0]["loss"] * 0.05
    loaded = load_checkpoint(result.checkpoint_dir)
    service = InferenceService(loaded.model, loaded.metadata)
    predictions = [
        service.generate_successor(str(value), include_trace=False) for value in range(10)
    ]
    assert [item["raw_output"] for item in predictions] == [
        "01",
        "02",
        "03",
        "04",
        "05",
        "06",
        "07",
        "08",
        "09",
        "10",
    ]
    assert all(item["correct"] for item in predictions)
    carry = predictions[9]
    assert carry["steps"][0]["context_ids"] == [9]
    assert carry["steps"][1]["context_ids"] == [9, 1]
    traced = service.generate_successor("4", include_trace=True)
    for step in traced["steps"]:
        assert step["trace"]["logit_lens"][-1]["probabilities"] == step["probabilities"]


def test_checkpoint_reload_preserves_logits_exactly(
    trained_lab: tuple[TrainResult, Database],
) -> None:
    result, _ = trained_lab
    first = load_checkpoint(result.checkpoint_dir)
    second = load_checkpoint(result.checkpoint_dir)
    inputs = torch.tensor([[4, 0]], dtype=torch.long)
    torch.testing.assert_close(
        first.model(inputs).logits,
        second.model(inputs).logits,
        rtol=0,
        atol=0,
    )
    training_state = load_trusted_training_state(result.checkpoint_dir)
    assert training_state["step"] == 300
    assert set(training_state["sampler_state"]) == {
        "generator_state",
        "order",
        "cursor",
        "batch_size",
        "dataset_length",
    }
    assert result.checkpoint_metadata["final_validation_metrics"] is None


def test_training_is_bit_reproducible_in_the_pinned_cpu_environment(tmp_path: Path) -> None:
    database = Database(tmp_path / "lab.sqlite3")
    database.initialize()
    config = ModelConfig(d_model=8, n_heads=2, n_layers=1, d_ff=16)
    build_all_datasets(database, tmp_path / "data", context_length=config.context_length)
    train_config = TrainConfig(
        steps=30,
        batch_size=10,
        learning_rate=0.01,
        min_learning_rate=0.001,
        warmup_steps=3,
        eval_interval=15,
        weight_decay=0.0,
        gradient_clip=1.0,
    )
    first = train_stage(
        database=database,
        dataset_name="sft_successor_full_v1",
        stage="repro-a",
        model_config=config,
        train_config=train_config,
        seed=77,
        artifacts_root=tmp_path / "artifacts",
    )
    second = train_stage(
        database=database,
        dataset_name="sft_successor_full_v1",
        stage="repro-b",
        model_config=config,
        train_config=train_config,
        seed=77,
        artifacts_root=tmp_path / "artifacts",
    )
    assert first.checkpoint_metadata["tensor_sha256"] == second.checkpoint_metadata["tensor_sha256"]


def test_sampler_state_restores_the_exact_next_minibatch() -> None:
    inputs = torch.arange(24).reshape(12, 2)
    targets = inputs + 1
    original = DeterministicBatcher(inputs, targets, batch_size=5, seed=91)
    original.next()
    state = original.state_dict()
    expected = original.next()
    restored = DeterministicBatcher(inputs, targets, batch_size=5, seed=999)
    restored.load_state_dict(state)
    actual = restored.next()
    torch.testing.assert_close(actual[0], expected[0], rtol=0, atol=0)
    torch.testing.assert_close(actual[1], expected[1], rtol=0, atol=0)


@pytest.mark.parametrize(
    ("field", "forged"),
    [
        ("run_id", "forged-run-id"),
        ("stage", "forged-stage"),
        ("seed", 123),
        ("parent_run_id", "forged-parent"),
    ],
)
def test_safetensors_embedded_metadata_rejects_sidecar_provenance_edits(
    trained_lab: tuple[TrainResult, Database],
    tmp_path: Path,
    field: str,
    forged: object,
) -> None:
    result, _ = trained_lab
    copied = tmp_path / f"forged-{field}"
    shutil.copytree(result.checkpoint_dir, copied)
    sidecar_path = copied / "checkpoint.json"
    sidecar = json.loads(sidecar_path.read_text(encoding="utf-8"))
    sidecar[field] = forged
    sidecar_path.write_text(json.dumps(sidecar), encoding="utf-8")
    with pytest.raises(ValueError, match="SAFETENSORS_EMBEDDED_METADATA_MISMATCH"):
        load_checkpoint(copied)


def test_completed_run_has_a_complete_hash_verified_artifact_ledger(
    trained_lab: tuple[TrainResult, Database],
) -> None:
    result, database = trained_lab
    assert database.verify_run_artifacts(result.run_id) == {
        "run_id": result.run_id,
        "artifact_count": 5,
        "verified": True,
    }
