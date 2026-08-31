from __future__ import annotations

import math
import os
import platform
import random
import subprocess
import sys
import uuid
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from importlib import metadata as importlib_metadata
from pathlib import Path
from typing import Any

import numpy as np
import torch
from torch import Tensor

from digit_lm.checkpoint import LoadedCheckpoint, load_checkpoint, save_checkpoint
from digit_lm.config import ModelConfig, TrainConfig
from digit_lm.db import Database
from digit_lm.hashing import sha256_file
from digit_lm.model import DigitTransformer
from digit_lm.paths import PROJECT_ROOT


@dataclass(frozen=True, slots=True)
class TrainResult:
    run_id: str
    stage: str
    checkpoint_dir: Path
    checkpoint_metadata: dict[str, Any]
    metrics: list[dict[str, Any]]


def seed_everything(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.set_num_threads(1)
    torch.use_deterministic_algorithms(True)


def quick_config(config: TrainConfig) -> TrainConfig:
    """Short path for tests and demonstrations; it is never labeled a final trained model."""

    steps = max(20, min(80, config.steps // 8))
    return replace(
        config,
        steps=steps,
        warmup_steps=max(1, min(config.warmup_steps, steps // 5)),
        eval_interval=max(5, min(config.eval_interval, steps // 2)),
    )


def examples_to_tensors(examples: list[dict[str, Any]]) -> tuple[Tensor, Tensor]:
    if not examples:
        raise ValueError("TRAINING_SPLIT_IS_EMPTY")
    inputs: list[list[int]] = []
    targets: list[list[int]] = []
    objective = str(examples[0]["objective"])
    for example in examples:
        if example["objective"] != objective:
            raise ValueError("MIXED_OBJECTIVES_IN_ONE_BATCH")
        input_ids = list(example["input_ids"])
        target_ids = list(example["target_ids"])
        if objective == "causal_lm":
            model_input = input_ids
            labels = target_ids
        elif objective == "successor_sft":
            if len(input_ids) != 1 or len(target_ids) != 2:
                raise ValueError("SFT_ROWS_REQUIRE_ONE_PROMPT_AND_TWO_TARGET_TOKENS")
            # Teacher forcing: [prompt, first target] predicts [first target, second target].
            model_input = input_ids + target_ids[:-1]
            labels = target_ids
        else:
            raise ValueError(f"UNKNOWN_OBJECTIVE: {objective}")
        inputs.append(model_input)
        targets.append(labels)
    lengths = {len(row) for row in inputs}
    if len(lengths) != 1:
        raise ValueError("FIXED_LENGTH_BATCH_REQUIRED_WITHOUT_A_PAD_TOKEN")
    return torch.tensor(inputs, dtype=torch.long), torch.tensor(targets, dtype=torch.long)


class DeterministicBatcher:
    def __init__(self, inputs: Tensor, targets: Tensor, *, batch_size: int, seed: int) -> None:
        self.inputs = inputs
        self.targets = targets
        self.batch_size = min(batch_size, len(inputs))
        self.generator = torch.Generator(device="cpu").manual_seed(seed)
        self.order = torch.randperm(len(inputs), generator=self.generator)
        self.cursor = 0

    def next(self) -> tuple[Tensor, Tensor]:
        if self.cursor + self.batch_size > len(self.inputs):
            self.order = torch.randperm(len(self.inputs), generator=self.generator)
            self.cursor = 0
        indices = self.order[self.cursor : self.cursor + self.batch_size]
        self.cursor += self.batch_size
        return self.inputs[indices], self.targets[indices]

    def state_dict(self) -> dict[str, Any]:
        return {
            "generator_state": self.generator.get_state(),
            "order": self.order.clone(),
            "cursor": self.cursor,
            "batch_size": self.batch_size,
            "dataset_length": len(self.inputs),
        }

    def load_state_dict(self, state: dict[str, Any]) -> None:
        if int(state["dataset_length"]) != len(self.inputs):
            raise ValueError("SAMPLER_DATASET_LENGTH_MISMATCH")
        if int(state["batch_size"]) != self.batch_size:
            raise ValueError("SAMPLER_BATCH_SIZE_MISMATCH")
        self.generator.set_state(state["generator_state"])
        self.order = state["order"].clone()
        self.cursor = int(state["cursor"])


def _optimizer(model: DigitTransformer, config: TrainConfig) -> torch.optim.AdamW:
    decay: list[Tensor] = []
    no_decay: list[Tensor] = []
    for parameter in model.parameters():
        (decay if parameter.ndim >= 2 else no_decay).append(parameter)
    return torch.optim.AdamW(
        [
            {"params": decay, "weight_decay": config.weight_decay},
            {"params": no_decay, "weight_decay": 0.0},
        ],
        lr=config.learning_rate,
        betas=(0.9, 0.95),
    )


def _learning_rate(step: int, config: TrainConfig) -> float:
    if step < config.warmup_steps:
        return config.learning_rate * (step + 1) / config.warmup_steps
    progress = (step - config.warmup_steps) / max(1, config.steps - config.warmup_steps - 1)
    cosine = 0.5 * (1.0 + math.cos(math.pi * progress))
    return config.min_learning_rate + cosine * (config.learning_rate - config.min_learning_rate)


@torch.inference_mode()
def evaluate_tensors(model: DigitTransformer, inputs: Tensor, targets: Tensor) -> dict[str, float]:
    model.eval()
    output = model(inputs, targets)
    assert output.loss is not None
    predicted = output.logits.argmax(dim=-1)
    loss = float(output.loss.item())
    return {
        "loss": loss,
        "token_accuracy": float((predicted == targets).float().mean().item()),
        "perplexity": float(math.exp(min(loss, 20.0))),
    }


def _source_fingerprint() -> str:
    import hashlib

    digest = hashlib.sha256()
    source_suffixes = {".py", ".sql", ".html", ".css", ".js"}
    source_files = sorted(
        path
        for path in (PROJECT_ROOT / "src").rglob("*")
        if path.is_file() and path.suffix in source_suffixes
    )
    source_files.extend(sorted((PROJECT_ROOT / "configs").glob("*.toml")))
    for path in source_files:
        digest.update(path.relative_to(PROJECT_ROOT).as_posix().encode("utf-8"))
        digest.update(path.read_bytes())
    return digest.hexdigest()


def _command_output(command: list[str]) -> str:
    try:
        completed = subprocess.run(
            command,
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=3,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return "unavailable"
    output = completed.stdout.strip()
    return output if completed.returncode == 0 and output else "unavailable"


def _environment(database: Database) -> dict[str, Any]:
    lock_path = PROJECT_ROOT / "uv.lock"
    python_version_path = PROJECT_ROOT / ".python-version"
    return {
        "python": sys.version,
        "torch": torch.__version__,
        "numpy": np.__version__,
        "fastapi": importlib_metadata.version("fastapi"),
        "safetensors": importlib_metadata.version("safetensors"),
        "uv": _command_output(["uv", "--version"]),
        "uv_lock_sha256": sha256_file(lock_path) if lock_path.exists() else None,
        "python_version_file": (
            python_version_path.read_text(encoding="utf-8").strip()
            if python_version_path.exists()
            else None
        ),
        "sqlite": database.sqlite_version(),
        "platform": platform.platform(),
        "processor": platform.processor(),
        "source_revision": _command_output(["git", "rev-parse", "HEAD"]),
        "source_fingerprint_sha256": _source_fingerprint(),
        "pid": os.getpid(),
        "deterministic_algorithms": torch.are_deterministic_algorithms_enabled(),
        "cpu_threads": torch.get_num_threads(),
    }


def _run_id(stage: str) -> str:
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    return f"{stage}-{stamp}-{uuid.uuid4().hex[:8]}"


def _weight_delta_norms(
    before: dict[str, Tensor] | None, model: DigitTransformer
) -> dict[str, float] | None:
    if before is None:
        return None
    result: dict[str, float] = {}
    squared_total = 0.0
    for name, current in model.state_dict().items():
        delta = (current.detach().cpu().float() - before[name].detach().cpu().float()).norm().item()
        result[name] = float(delta)
        squared_total += delta * delta
    result["__total__"] = math.sqrt(squared_total)
    return result


def train_stage(
    *,
    database: Database,
    dataset_name: str,
    stage: str,
    model_config: ModelConfig,
    train_config: TrainConfig,
    seed: int,
    artifacts_root: Path,
    parent_checkpoint: Path | None = None,
) -> TrainResult:
    seed_everything(seed)
    database.verify_dataset(dataset_name)
    parent: LoadedCheckpoint | None = None
    if parent_checkpoint is None:
        model = DigitTransformer(model_config)
        initial_state = None
        parent_run_id = None
    else:
        parent = load_checkpoint(parent_checkpoint)
        if parent.model.config != model_config:
            raise ValueError("PARENT_MODEL_CONFIG_MISMATCH")
        model = parent.model
        initial_state = {
            name: tensor.detach().cpu().clone() for name, tensor in model.state_dict().items()
        }
        parent_run_id = str(parent.metadata["run_id"])

    train_examples = database.load_examples(dataset_name, "train")
    validation_examples = database.load_examples(dataset_name, "validation")
    train_inputs, train_targets = examples_to_tensors(train_examples)
    if validation_examples:
        validation_inputs, validation_targets = examples_to_tensors(validation_examples)
        validation_split = "validation"
    else:
        validation_inputs, validation_targets = train_inputs, train_targets
        validation_split = "train"

    dataset_record = database.dataset_by_name(dataset_name)
    run_id = _run_id(stage)
    optimizer = _optimizer(model, train_config)
    batcher = DeterministicBatcher(
        train_inputs, train_targets, batch_size=train_config.batch_size, seed=seed + 1
    )
    environment = _environment(database)
    database.create_run(
        {
            "run_id": run_id,
            "stage": stage,
            "parent_run_id": parent_run_id,
            "dataset_id": dataset_record["dataset_id"],
            "seed": seed,
            "device": "cpu",
            "model_config": model_config.to_dict(),
            "train_config": train_config.to_dict(),
            "environment": environment,
            "parameter_count": model.parameter_count(),
        }
    )

    metrics: list[dict[str, Any]] = []
    best_loss = float("inf")
    best_step = 0

    def record(step: int, split: str, values: dict[str, float], lr: float, grad: float) -> None:
        nonlocal best_loss, best_step
        metric: dict[str, Any] = {
            "step": step,
            "split": split,
            **values,
            "learning_rate": lr,
            "gradient_norm": grad,
        }
        metrics.append(metric)
        database.record_metric(run_id, metric)
        if split == validation_split and values["loss"] < best_loss:
            best_loss = values["loss"]
            best_step = step

    try:
        baseline_train = evaluate_tensors(model, train_inputs, train_targets)
        record(0, "train", baseline_train, 0.0, 0.0)
        if validation_split != "train":
            baseline_validation = evaluate_tensors(model, validation_inputs, validation_targets)
            record(0, validation_split, baseline_validation, 0.0, 0.0)

        for step in range(train_config.steps):
            model.train()
            learning_rate = _learning_rate(step, train_config)
            for group in optimizer.param_groups:
                group["lr"] = learning_rate
            batch_inputs, batch_targets = batcher.next()
            optimizer.zero_grad(set_to_none=True)
            output = model(batch_inputs, batch_targets)
            assert output.loss is not None
            output.loss.backward()
            gradient_norm = float(
                torch.nn.utils.clip_grad_norm_(
                    model.parameters(), train_config.gradient_clip
                ).item()
            )
            optimizer.step()

            completed_step = step + 1
            should_evaluate = (
                completed_step % train_config.eval_interval == 0
                or completed_step == train_config.steps
            )
            if should_evaluate:
                train_values = evaluate_tensors(model, train_inputs, train_targets)
                record(completed_step, "train", train_values, learning_rate, gradient_norm)
                if validation_split != "train":
                    validation_values = evaluate_tensors(
                        model, validation_inputs, validation_targets
                    )
                    record(
                        completed_step,
                        validation_split,
                        validation_values,
                        learning_rate,
                        gradient_norm,
                    )

        # The locked test split is not even loaded until every optimizer step has finished.
        test_examples = database.load_examples(dataset_name, "test")
        final_test_metrics = None
        if test_examples:
            test_tensors = examples_to_tensors(test_examples)
            final_test_metrics = evaluate_tensors(model, *test_tensors)
            record(
                train_config.steps,
                "test",
                final_test_metrics,
                _learning_rate(train_config.steps - 1, train_config),
                0.0,
            )

        checkpoint_dir = artifacts_root / "runs" / run_id
        delta_norms = _weight_delta_norms(initial_state, model)
        checkpoint_metadata = save_checkpoint(
            checkpoint_dir,
            model=model,
            metadata={
                "run_id": run_id,
                "stage": stage,
                "dataset_id": dataset_record["dataset_id"],
                "dataset_manifest_sha256": dataset_record["manifest_sha256"],
                "parent_run_id": parent_run_id,
                "parent_tensor_sha256": (
                    parent.metadata["tensor_sha256"] if parent is not None else None
                ),
                "seed": seed,
                "device": "cpu",
                "environment": environment,
                "train_config": train_config.to_dict(),
                "weight_delta_norms": delta_norms,
                "completed_steps": train_config.steps,
                "final_train_metrics": evaluate_tensors(model, train_inputs, train_targets),
                "final_validation_metrics": (
                    evaluate_tensors(model, validation_inputs, validation_targets)
                    if validation_split == "validation"
                    else None
                ),
                "metric_selection_split": validation_split,
                "best_observed_metric": {
                    "split": validation_split,
                    "step": best_step,
                    "loss": best_loss,
                },
                "checkpoint_selection": "final_step_for_optimizer_state_alignment",
                "final_test_metrics": final_test_metrics,
            },
            optimizer=optimizer,
            step=train_config.steps,
            metrics=metrics,
            sampler_state=batcher.state_dict(),
        )
        artifacts: list[dict[str, Any]] = []
        for kind, filename in (
            ("weights", "model.safetensors"),
            ("metadata", "checkpoint.json"),
            ("metrics", "metrics.json"),
            ("training_state", "training_state.pt"),
            ("tokenizer", "tokenizer.json"),
        ):
            path = checkpoint_dir / filename
            artifacts.append(
                {
                    "kind": kind,
                    "path": str(path),
                    "sha256": sha256_file(path),
                    "size_bytes": path.stat().st_size,
                }
            )
        database.complete_run(
            run_id,
            best_loss=best_loss,
            checkpoint_path=str(checkpoint_dir),
            checkpoint_sha256=str(checkpoint_metadata["checkpoint_sha256"]),
            tensor_sha256=str(checkpoint_metadata["tensor_sha256"]),
            artifacts=artifacts,
        )
        return TrainResult(
            run_id=run_id,
            stage=stage,
            checkpoint_dir=checkpoint_dir,
            checkpoint_metadata=checkpoint_metadata,
            metrics=metrics,
        )
    except Exception as error:
        database.finish_run(run_id, status="failed", error_text=repr(error))
        raise
