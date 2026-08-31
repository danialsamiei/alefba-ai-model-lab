from __future__ import annotations

import tomllib
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from reasoning_lab.paths import CONFIG_PATH


def _positive(name: str, value: int | float) -> None:
    if value <= 0:
        raise ValueError(f"{name.upper()}_MUST_BE_POSITIVE")


@dataclass(frozen=True, slots=True)
class ModelConfig:
    context_length: int
    d_model: int
    n_heads: int
    n_layers: int
    d_ff: int
    dropout: float
    window_size: int
    n_experts: int
    top_k: int
    router_aux_weight: float
    router_z_weight: float

    def __post_init__(self) -> None:
        for name in (
            "context_length",
            "d_model",
            "n_heads",
            "n_layers",
            "d_ff",
            "window_size",
            "n_experts",
        ):
            _positive(name, int(getattr(self, name)))
        if self.d_model % self.n_heads != 0:
            raise ValueError("D_MODEL_MUST_BE_DIVISIBLE_BY_N_HEADS")
        if self.window_size > self.context_length:
            raise ValueError("WINDOW_SIZE_MUST_NOT_EXCEED_CONTEXT_LENGTH")
        if not 0.0 <= self.dropout < 1.0:
            raise ValueError("DROPOUT_MUST_BE_IN_HALF_OPEN_INTERVAL_ZERO_ONE")
        if self.top_k != 1:
            raise ValueError("MICRO_MOE_REQUIRES_TOP_K_ONE")
        if self.router_aux_weight < 0.0 or self.router_z_weight < 0.0:
            raise ValueError("ROUTER_LOSS_WEIGHTS_MUST_BE_NON_NEGATIVE")

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> ModelConfig:
        return cls(**value)


@dataclass(frozen=True, slots=True)
class DataConfig:
    seed: int
    train_episodes: int
    validation_episodes: int
    iid_test_episodes: int
    depth_ood_episodes: int
    rag_holdout_episodes: int
    train_max_depth: int
    ood_depth: int
    max_distractors: int

    def __post_init__(self) -> None:
        for name in (
            "train_episodes",
            "validation_episodes",
            "iid_test_episodes",
            "depth_ood_episodes",
            "rag_holdout_episodes",
            "train_max_depth",
            "ood_depth",
        ):
            _positive(name, int(getattr(self, name)))
        if self.max_distractors < 0:
            raise ValueError("MAX_DISTRACTORS_MUST_BE_NON_NEGATIVE")
        if self.ood_depth <= self.train_max_depth:
            raise ValueError("OOD_DEPTH_MUST_EXCEED_TRAIN_MAX_DEPTH")

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class TrainConfig:
    steps: int
    batch_size: int
    learning_rate: float
    min_learning_rate: float
    warmup_steps: int
    eval_interval: int
    weight_decay: float
    gradient_clip: float

    def __post_init__(self) -> None:
        for name in ("steps", "batch_size", "learning_rate", "eval_interval", "gradient_clip"):
            _positive(name, getattr(self, name))
        if self.min_learning_rate < 0.0:
            raise ValueError("MIN_LEARNING_RATE_MUST_BE_NON_NEGATIVE")
        if self.min_learning_rate > self.learning_rate:
            raise ValueError("MIN_LEARNING_RATE_MUST_NOT_EXCEED_LEARNING_RATE")
        if not 0 <= self.warmup_steps <= self.steps:
            raise ValueError("WARMUP_STEPS_MUST_BE_BETWEEN_ZERO_AND_STEPS")
        if self.weight_decay < 0.0:
            raise ValueError("WEIGHT_DECAY_MUST_BE_NON_NEGATIVE")

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class LabConfig:
    seed: int
    evaluation_limit_per_split: int
    body_limit_bytes: int

    def __post_init__(self) -> None:
        _positive("evaluation_limit_per_split", self.evaluation_limit_per_split)
        _positive("body_limit_bytes", self.body_limit_bytes)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class ProjectConfig:
    model: ModelConfig
    data: DataConfig
    window_mlp_train: TrainConfig
    dense_direct_train: TrainConfig
    dense_scratch_train: TrainConfig
    moe_scratch_train: TrainConfig
    lab: LabConfig

    def to_dict(self) -> dict[str, Any]:
        return {
            "model": self.model.to_dict(),
            "data": self.data.to_dict(),
            "window_mlp_train": self.window_mlp_train.to_dict(),
            "dense_direct_train": self.dense_direct_train.to_dict(),
            "dense_scratch_train": self.dense_scratch_train.to_dict(),
            "moe_scratch_train": self.moe_scratch_train.to_dict(),
            "lab": self.lab.to_dict(),
        }

    def training_for(self, profile: str) -> TrainConfig:
        profiles = {
            "window_mlp": self.window_mlp_train,
            "dense_direct": self.dense_direct_train,
            "dense_scratch": self.dense_scratch_train,
            "moe_scratch": self.moe_scratch_train,
        }
        try:
            return profiles[profile]
        except KeyError as error:
            raise KeyError(f"UNKNOWN_TRAINING_PROFILE: {profile}") from error


def _section(raw: dict[str, Any], name: str) -> dict[str, Any]:
    value = raw.get(name)
    if not isinstance(value, dict):
        raise ValueError(f"MISSING_OR_INVALID_CONFIG_SECTION: {name}")
    return value


def load_project_config(path: Path | str = CONFIG_PATH) -> ProjectConfig:
    config_path = Path(path).expanduser().resolve()
    with config_path.open("rb") as handle:
        raw = tomllib.load(handle)
    return ProjectConfig(
        model=ModelConfig(**_section(raw, "model")),
        data=DataConfig(**_section(raw, "data")),
        window_mlp_train=TrainConfig(**_section(raw, "window_mlp_train")),
        dense_direct_train=TrainConfig(**_section(raw, "dense_direct_train")),
        dense_scratch_train=TrainConfig(**_section(raw, "dense_scratch_train")),
        moe_scratch_train=TrainConfig(**_section(raw, "moe_scratch_train")),
        lab=LabConfig(**_section(raw, "lab")),
    )
