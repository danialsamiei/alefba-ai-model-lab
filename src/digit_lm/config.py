from __future__ import annotations

import tomllib
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True, slots=True)
class ModelConfig:
    """Every architecture dimension needed to reconstruct a checkpoint."""

    vocab_size: int = 10
    context_length: int = 8
    d_model: int = 32
    n_heads: int = 4
    n_layers: int = 2
    d_ff: int = 64
    dropout: float = 0.0

    def __post_init__(self) -> None:
        if self.vocab_size != 10:
            raise ValueError("VOCAB_SIZE_MUST_BE_EXACTLY_10")
        if self.d_model % self.n_heads != 0:
            raise ValueError("D_MODEL_MUST_BE_DIVISIBLE_BY_N_HEADS")
        if self.context_length < 2:
            raise ValueError("CONTEXT_LENGTH_MUST_ALLOW_TWO_TOKEN_GENERATION")

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> ModelConfig:
        return cls(**raw)


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
        if self.steps < 1 or self.batch_size < 1:
            raise ValueError("TRAINING_STEPS_AND_BATCH_SIZE_MUST_BE_POSITIVE")
        if self.warmup_steps >= self.steps:
            raise ValueError("WARMUP_MUST_BE_SHORTER_THAN_TRAINING")

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class LabConfig:
    seed: int
    canonical_pretrain_dataset: str
    full_sft_dataset: str
    holdout_pretrain_dataset: str
    holdout_sft_dataset: str
    mapping_holdout_sft_dataset: str
    corrupt_sft_dataset: str
    true_probe_dataset: str
    corrupt_probe_dataset: str


@dataclass(frozen=True, slots=True)
class ProjectConfig:
    model: ModelConfig
    canonical_pretrain: TrainConfig
    finetune: TrainConfig
    holdout_pretrain: TrainConfig
    holdout_finetune: TrainConfig
    corrupt_finetune: TrainConfig
    lab: LabConfig


def load_project_config(path: Path) -> ProjectConfig:
    with path.open("rb") as handle:
        raw = tomllib.load(handle)
    return ProjectConfig(
        model=ModelConfig.from_dict(raw["model"]),
        canonical_pretrain=TrainConfig(**raw["canonical_pretrain"]),
        finetune=TrainConfig(**raw["finetune"]),
        holdout_pretrain=TrainConfig(**raw["holdout_pretrain"]),
        holdout_finetune=TrainConfig(**raw["holdout_finetune"]),
        corrupt_finetune=TrainConfig(**raw["corrupt_finetune"]),
        lab=LabConfig(**raw["lab"]),
    )
