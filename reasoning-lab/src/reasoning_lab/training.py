from __future__ import annotations

import hashlib
import json
import math
import random
from collections.abc import Mapping, Sequence
from dataclasses import asdict, dataclass, field
from pathlib import Path
from types import MappingProxyType
from typing import Any, Final, Protocol

import torch
from torch import Tensor

from reasoning_lab.checkpoint import save_checkpoint
from reasoning_lab.config import ProjectConfig, TrainConfig
from reasoning_lab.models import LanguageModel, build_model

OBJECTIVES: Final = frozenset({"direct", "scratch", "tool"})
SPLITS: Final = frozenset({"train", "validation", "iid_test", "depth_ood", "rag_holdout"})


@dataclass(frozen=True, slots=True)
class ProfileSpec:
    name: str
    config_profile: str
    model_kind: str
    objective: str


_WINDOW_PROFILE = ProfileSpec("window_mlp", "window_mlp", "window_mlp", "direct")
_DIRECT_PROFILE = ProfileSpec("dense_direct", "dense_direct", "dense_transformer", "direct")
_SCRATCH_PROFILE = ProfileSpec("dense_scratch", "dense_scratch", "dense_transformer", "scratch")
_MOE_PROFILE = ProfileSpec("moe_scratch", "moe_scratch", "moe_transformer", "scratch")

PROFILE_SPECS: Final[Mapping[str, ProfileSpec]] = MappingProxyType(
    {
        "window_mlp": _WINDOW_PROFILE,
        "direct": _DIRECT_PROFILE,
        "dense_direct": _DIRECT_PROFILE,
        "scratch": _SCRATCH_PROFILE,
        "dense_scratch": _SCRATCH_PROFILE,
        "moe": _MOE_PROFILE,
        "moe_scratch": _MOE_PROFILE,
    }
)


def profile_spec(profile: str) -> ProfileSpec:
    try:
        return PROFILE_SPECS[profile]
    except KeyError as error:
        raise ValueError(f"UNKNOWN_TRAINING_PROFILE: {profile}") from error


def objective_for_profile(profile: str) -> str:
    return profile_spec(profile).objective


def model_kind_for_profile(profile: str) -> str:
    return profile_spec(profile).model_kind


def _canonical_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


class TrainingExampleLike(Protocol):
    """Structural contract also satisfied by ``reasoning_lab.data.TrainingExample``."""

    @property
    def token_ids(self) -> Sequence[int]: ...

    @property
    def loss_mask(self) -> Sequence[bool | int]: ...

    @property
    def objective(self) -> str: ...

    @property
    def split(self) -> str: ...

    @property
    def episode_id(self) -> str: ...

    @property
    def metadata(self) -> Mapping[str, object]: ...


@dataclass(frozen=True, slots=True)
class TrainingExample:
    token_ids: Sequence[int]
    loss_mask: Sequence[bool | int]
    objective: str
    split: str
    episode_id: str
    metadata: Mapping[str, object] = field(default_factory=dict)

    def __post_init__(self) -> None:
        tokens: list[int] = []
        for value in self.token_ids:
            if isinstance(value, bool) or not isinstance(value, int):
                raise TypeError("TRAINING_TOKEN_ID_MUST_BE_AN_INTEGER")
            if value < 0:
                raise ValueError("TRAINING_TOKEN_ID_MUST_BE_NON_NEGATIVE")
            tokens.append(value)
        masks: list[bool] = []
        for value in self.loss_mask:
            if isinstance(value, bool):
                masks.append(value)
            elif isinstance(value, int) and value in (0, 1):
                masks.append(bool(value))
            else:
                raise TypeError("TRAINING_LOSS_MASK_MUST_CONTAIN_BOOLEANS")
        if len(tokens) < 2:
            raise ValueError("TRAINING_SEQUENCE_REQUIRES_AT_LEAST_TWO_TOKENS")
        if len(tokens) != len(masks):
            raise ValueError("TRAINING_TOKEN_IDS_AND_LOSS_MASK_MUST_HAVE_EQUAL_LENGTH")
        if not any(masks[1:]):
            raise ValueError("TRAINING_EXAMPLE_HAS_NO_NEXT_TOKEN_OBJECTIVE")
        if self.objective not in OBJECTIVES:
            raise ValueError(f"UNKNOWN_TRAINING_OBJECTIVE: {self.objective}")
        if self.split not in SPLITS:
            raise ValueError(f"UNKNOWN_DATASET_SPLIT: {self.split}")
        if not self.episode_id:
            raise ValueError("TRAINING_EPISODE_ID_MUST_NOT_BE_EMPTY")
        metadata = dict(self.metadata)
        try:
            _canonical_json(metadata)
        except (TypeError, ValueError) as error:
            raise TypeError("TRAINING_METADATA_MUST_BE_JSON_SERIALIZABLE") from error
        object.__setattr__(self, "token_ids", tuple(tokens))
        object.__setattr__(self, "loss_mask", tuple(masks))
        object.__setattr__(self, "metadata", MappingProxyType(metadata))


@dataclass(frozen=True, slots=True)
class TrainingBatch:
    input_ids: Tensor
    targets: Tensor
    loss_mask: Tensor
    sequence_lengths: Tensor
    episode_ids: tuple[str, ...]

    @property
    def supervised_tokens(self) -> int:
        return int(self.loss_mask.sum().item())


def collate_training_examples(
    examples: Sequence[TrainingExampleLike],
    *,
    pad_token_id: int,
) -> TrainingBatch:
    """Right-pad examples after applying the autoregressive one-token shift."""

    if not examples:
        raise ValueError("TRAINING_BATCH_MUST_NOT_BE_EMPTY")
    if isinstance(pad_token_id, bool) or not isinstance(pad_token_id, int):
        raise TypeError("PAD_TOKEN_ID_MUST_BE_AN_INTEGER")
    if pad_token_id < 0:
        raise ValueError("PAD_TOKEN_ID_MUST_BE_NON_NEGATIVE")
    for example in examples:
        if len(example.token_ids) < 2:
            raise ValueError(f"TRAINING_SEQUENCE_TOO_SHORT: {example.episode_id}")
        if len(example.token_ids) != len(example.loss_mask):
            raise ValueError(f"TRAINING_TOKEN_MASK_LENGTH_MISMATCH: {example.episode_id}")
        if not any(bool(selected) for selected in example.loss_mask[1:]):
            raise ValueError(f"TRAINING_EXAMPLE_HAS_NO_SHIFTED_OBJECTIVE: {example.episode_id}")
    shifted_lengths = [len(example.token_ids) - 1 for example in examples]
    maximum_length = max(shifted_lengths)
    batch_size = len(examples)
    input_ids = torch.full(
        (batch_size, maximum_length), pad_token_id, dtype=torch.long, device="cpu"
    )
    targets = torch.full((batch_size, maximum_length), pad_token_id, dtype=torch.long, device="cpu")
    loss_mask = torch.zeros((batch_size, maximum_length), dtype=torch.bool, device="cpu")
    for row, example in enumerate(examples):
        length = shifted_lengths[row]
        input_ids[row, :length] = torch.tensor(example.token_ids[:-1], dtype=torch.long)
        targets[row, :length] = torch.tensor(example.token_ids[1:], dtype=torch.long)
        loss_mask[row, :length] = torch.tensor(example.loss_mask[1:], dtype=torch.bool)
    return TrainingBatch(
        input_ids=input_ids,
        targets=targets,
        loss_mask=loss_mask,
        sequence_lengths=torch.tensor(shifted_lengths, dtype=torch.long),
        episode_ids=tuple(example.episode_id for example in examples),
    )


@dataclass(frozen=True, slots=True)
class StepTelemetry:
    step: int
    learning_rate: float
    token_loss: float
    auxiliary_loss: float
    total_loss: float
    gradient_norm: float
    supervised_tokens: int

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class ValidationTelemetry:
    step: int
    split: str
    objective: str
    token_loss: float
    auxiliary_loss: float
    total_loss: float
    supervised_tokens: int
    example_count: int

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class RunTelemetry:
    profile: str
    model_kind: str
    objective: str
    seed: int
    device: str
    train_example_count: int
    validation_example_count: int
    training_data_sha256: str
    steps: tuple[StepTelemetry, ...]
    validations: tuple[ValidationTelemetry, ...]

    def to_dict(self) -> dict[str, object]:
        return {
            "profile": self.profile,
            "model_kind": self.model_kind,
            "objective": self.objective,
            "seed": self.seed,
            "device": self.device,
            "train_example_count": self.train_example_count,
            "validation_example_count": self.validation_example_count,
            "training_data_sha256": self.training_data_sha256,
            "steps": [step.to_dict() for step in self.steps],
            "validations": [validation.to_dict() for validation in self.validations],
        }


@dataclass(frozen=True, slots=True)
class TrainingResult:
    model: LanguageModel
    telemetry: RunTelemetry
    checkpoint_metadata: dict[str, Any] | None


def learning_rate_for_step(config: TrainConfig, step: int) -> float:
    """Return the 1-indexed linear-warmup/cosine-decay learning rate."""

    if isinstance(step, bool) or not isinstance(step, int):
        raise TypeError("SCHEDULER_STEP_MUST_BE_AN_INTEGER")
    if not 1 <= step <= config.steps:
        raise ValueError("SCHEDULER_STEP_OUTSIDE_TRAINING_RANGE")
    if config.warmup_steps and step <= config.warmup_steps:
        return config.learning_rate * step / config.warmup_steps
    decay_steps = config.steps - config.warmup_steps
    if decay_steps <= 1:
        return config.min_learning_rate
    progress = (step - config.warmup_steps - 1) / (decay_steps - 1)
    cosine = 0.5 * (1.0 + math.cos(math.pi * progress))
    return config.min_learning_rate + (config.learning_rate - config.min_learning_rate) * cosine


class _DeterministicBatchStream:
    def __init__(
        self,
        examples: Sequence[TrainingExampleLike],
        *,
        batch_size: int,
        seed: int,
    ) -> None:
        self.examples = tuple(examples)
        self.batch_size = batch_size
        self.rng = random.Random(seed)
        self.order: list[int] = []
        self.position = 0

    def _new_epoch(self) -> None:
        self.order = list(range(len(self.examples)))
        self.rng.shuffle(self.order)
        self.position = 0

    def next(self) -> tuple[TrainingExampleLike, ...]:
        selected: list[TrainingExampleLike] = []
        while len(selected) < self.batch_size:
            if self.position >= len(self.order):
                self._new_epoch()
            take = min(self.batch_size - len(selected), len(self.order) - self.position)
            indices = self.order[self.position : self.position + take]
            selected.extend(self.examples[index] for index in indices)
            self.position += take
        return tuple(selected)


def _example_record(example: TrainingExampleLike) -> dict[str, object]:
    return {
        "episode_id": example.episode_id,
        "objective": example.objective,
        "split": example.split,
        "token_ids": list(example.token_ids),
        "loss_mask": list(example.loss_mask),
        "metadata": dict(example.metadata),
    }


def training_data_sha256(
    train_examples: Sequence[TrainingExampleLike],
    validation_examples: Sequence[TrainingExampleLike] = (),
) -> str:
    payload = {
        "train": [_example_record(example) for example in train_examples],
        "validation": [_example_record(example) for example in validation_examples],
    }
    return hashlib.sha256(_canonical_json(payload).encode("utf-8")).hexdigest()


def _validate_examples_for_model(
    examples: Sequence[TrainingExampleLike],
    *,
    model: LanguageModel,
    objective: str,
    split: str,
) -> None:
    for example in examples:
        if len(example.token_ids) < 2:
            raise ValueError(f"TRAINING_SEQUENCE_TOO_SHORT: {example.episode_id}")
        if len(example.token_ids) != len(example.loss_mask):
            raise ValueError(f"TRAINING_TOKEN_MASK_LENGTH_MISMATCH: {example.episode_id}")
        if not any(bool(selected) for selected in example.loss_mask[1:]):
            raise ValueError(f"TRAINING_EXAMPLE_HAS_NO_SHIFTED_OBJECTIVE: {example.episode_id}")
        if example.objective != objective:
            raise ValueError(f"EXAMPLE_OBJECTIVE_DOES_NOT_MATCH_PROFILE: {example.episode_id}")
        if example.split != split:
            raise ValueError(f"EXAMPLE_SPLIT_MUST_BE_{split.upper()}: {example.episode_id}")
        if len(example.token_ids) - 1 > model.config.context_length:
            raise ValueError(f"EXAMPLE_EXCEEDS_MODEL_CONTEXT: {example.episode_id}")
        if any(token_id >= model.vocab_size for token_id in example.token_ids):
            raise ValueError(f"EXAMPLE_TOKEN_OUT_OF_MODEL_VOCABULARY: {example.episode_id}")


def _evaluate(
    model: LanguageModel,
    examples: Sequence[TrainingExampleLike],
    *,
    batch_size: int,
    pad_token_id: int,
    step: int,
    objective: str,
) -> ValidationTelemetry:
    was_training = model.training
    model.eval()
    token_loss_sum = 0.0
    auxiliary_loss_sum = 0.0
    supervised_tokens = 0
    evaluated_examples = 0
    with torch.no_grad():
        for start in range(0, len(examples), batch_size):
            batch_examples = examples[start : start + batch_size]
            batch = collate_training_examples(batch_examples, pad_token_id=pad_token_id)
            output = model(batch.input_ids, batch.targets, batch.loss_mask)
            if output.loss is None:
                raise AssertionError("VALIDATION_MODEL_DID_NOT_RETURN_TOKEN_LOSS")
            batch_tokens = batch.supervised_tokens
            token_loss_sum += float(output.loss.item()) * batch_tokens
            auxiliary_loss_sum += float(output.auxiliary_loss.item()) * len(batch_examples)
            supervised_tokens += batch_tokens
            evaluated_examples += len(batch_examples)
    if was_training:
        model.train()
    token_loss = token_loss_sum / supervised_tokens
    auxiliary_loss = auxiliary_loss_sum / evaluated_examples
    return ValidationTelemetry(
        step=step,
        split="validation",
        objective=objective,
        token_loss=token_loss,
        auxiliary_loss=auxiliary_loss,
        total_loss=token_loss + auxiliary_loss,
        supervised_tokens=supervised_tokens,
        example_count=evaluated_examples,
    )


def train_model(
    model: LanguageModel,
    train_examples: Sequence[TrainingExampleLike],
    validation_examples: Sequence[TrainingExampleLike] = (),
    *,
    profile: str,
    config: TrainConfig,
    pad_token_id: int,
    seed: int,
    checkpoint_dir: Path | str | None = None,
    checkpoint_metadata: Mapping[str, object] | None = None,
) -> TrainingResult:
    """Train an existing language model deterministically on CPU.

    The caller controls initial weights.  For deterministic initialization as
    well as training, use :func:`train_profile`, which builds under the same
    seed recorded in the telemetry and checkpoint.
    """

    spec = profile_spec(profile)
    if model.model_kind != spec.model_kind:
        raise ValueError("MODEL_KIND_DOES_NOT_MATCH_TRAINING_PROFILE")
    if not train_examples:
        raise ValueError("TRAINING_SET_MUST_NOT_BE_EMPTY")
    if isinstance(seed, bool) or not isinstance(seed, int):
        raise TypeError("TRAINING_SEED_MUST_BE_AN_INTEGER")
    if isinstance(pad_token_id, bool) or not isinstance(pad_token_id, int):
        raise TypeError("PAD_TOKEN_ID_MUST_BE_AN_INTEGER")
    if not 0 <= pad_token_id < model.vocab_size:
        raise ValueError("PAD_TOKEN_ID_OUT_OF_MODEL_VOCABULARY")
    _validate_examples_for_model(
        train_examples, model=model, objective=spec.objective, split="train"
    )
    _validate_examples_for_model(
        validation_examples,
        model=model,
        objective=spec.objective,
        split="validation",
    )
    data_hash = training_data_sha256(train_examples, validation_examples)
    supplied_checkpoint_metadata = dict(checkpoint_metadata or {})
    generated_metadata_keys = {
        "training_profile",
        "training_objective",
        "training_seed",
        "training_config",
        "training_data_sha256",
        "run_telemetry",
    }
    collisions = sorted(generated_metadata_keys.intersection(supplied_checkpoint_metadata))
    if collisions:
        raise ValueError(f"RESERVED_TRAINING_METADATA_KEYS: {','.join(collisions)}")
    try:
        _canonical_json(supplied_checkpoint_metadata)
    except (TypeError, ValueError) as error:
        raise TypeError("CHECKPOINT_METADATA_MUST_BE_JSON_SERIALIZABLE") from error

    previous_deterministic = torch.are_deterministic_algorithms_enabled()
    previous_threads = torch.get_num_threads()
    step_telemetry: list[StepTelemetry] = []
    validation_telemetry: list[ValidationTelemetry] = []
    try:
        torch.use_deterministic_algorithms(True)
        torch.set_num_threads(1)
        with torch.random.fork_rng(devices=[]):
            torch.manual_seed(seed)
            model.to("cpu")
            optimizer = torch.optim.AdamW(
                model.parameters(),
                lr=config.learning_rate,
                weight_decay=config.weight_decay,
                foreach=False,
            )
            batches = _DeterministicBatchStream(
                train_examples, batch_size=config.batch_size, seed=seed
            )
            for step in range(1, config.steps + 1):
                learning_rate = learning_rate_for_step(config, step)
                for parameter_group in optimizer.param_groups:
                    parameter_group["lr"] = learning_rate
                model.train()
                batch = collate_training_examples(batches.next(), pad_token_id=pad_token_id)
                optimizer.zero_grad(set_to_none=True)
                output = model(batch.input_ids, batch.targets, batch.loss_mask)
                if output.loss is None:
                    raise AssertionError("TRAINING_MODEL_DID_NOT_RETURN_TOKEN_LOSS")
                total_loss = output.loss + output.auxiliary_loss
                if not bool(torch.isfinite(total_loss).item()):
                    raise FloatingPointError(f"NON_FINITE_TRAINING_LOSS_AT_STEP_{step}")
                total_loss.backward()
                gradient_norm_tensor = torch.nn.utils.clip_grad_norm_(
                    model.parameters(), config.gradient_clip
                )
                gradient_norm = float(gradient_norm_tensor.item())
                if not math.isfinite(gradient_norm):
                    raise FloatingPointError(f"NON_FINITE_GRADIENT_NORM_AT_STEP_{step}")
                optimizer.step()
                step_telemetry.append(
                    StepTelemetry(
                        step=step,
                        learning_rate=learning_rate,
                        token_loss=float(output.loss.detach().item()),
                        auxiliary_loss=float(output.auxiliary_loss.detach().item()),
                        total_loss=float(total_loss.detach().item()),
                        gradient_norm=gradient_norm,
                        supervised_tokens=batch.supervised_tokens,
                    )
                )
                should_validate = validation_examples and (
                    step % config.eval_interval == 0 or step == config.steps
                )
                if should_validate:
                    validation_telemetry.append(
                        _evaluate(
                            model,
                            validation_examples,
                            batch_size=config.batch_size,
                            pad_token_id=pad_token_id,
                            step=step,
                            objective=spec.objective,
                        )
                    )
    finally:
        torch.set_num_threads(previous_threads)
        torch.use_deterministic_algorithms(previous_deterministic)

    model.eval()
    telemetry = RunTelemetry(
        profile=spec.name,
        model_kind=spec.model_kind,
        objective=spec.objective,
        seed=seed,
        device="cpu",
        train_example_count=len(train_examples),
        validation_example_count=len(validation_examples),
        training_data_sha256=data_hash,
        steps=tuple(step_telemetry),
        validations=tuple(validation_telemetry),
    )
    saved_metadata: dict[str, Any] | None = None
    if checkpoint_dir is not None:
        saved_metadata = save_checkpoint(
            Path(checkpoint_dir),
            model=model,
            metadata={
                **supplied_checkpoint_metadata,
                "training_profile": spec.name,
                "training_objective": spec.objective,
                "training_seed": seed,
                "training_config": config.to_dict(),
                "training_data_sha256": data_hash,
                "run_telemetry": telemetry.to_dict(),
            },
        )
    return TrainingResult(
        model=model,
        telemetry=telemetry,
        checkpoint_metadata=saved_metadata,
    )


def train_profile(
    profile: str,
    project_config: ProjectConfig,
    examples: Sequence[TrainingExampleLike],
    *,
    vocab_size: int,
    pad_token_id: int,
    checkpoint_dir: Path | str | None = None,
    checkpoint_metadata: Mapping[str, object] | None = None,
    seed: int | None = None,
) -> TrainingResult:
    """Build and train one configured profile from a mixed example collection."""

    spec = profile_spec(profile)
    actual_seed = project_config.lab.seed if seed is None else seed
    train_examples = tuple(
        example
        for example in examples
        if example.objective == spec.objective and example.split == "train"
    )
    validation_examples = tuple(
        example
        for example in examples
        if example.objective == spec.objective and example.split == "validation"
    )
    with torch.random.fork_rng(devices=[]):
        torch.manual_seed(actual_seed)
        model = build_model(spec.model_kind, project_config.model, vocab_size)
    return train_model(
        model,
        train_examples,
        validation_examples,
        profile=spec.name,
        config=project_config.training_for(spec.config_profile),
        pad_token_id=pad_token_id,
        seed=actual_seed,
        checkpoint_dir=checkpoint_dir,
        checkpoint_metadata=checkpoint_metadata,
    )


# Notebook-friendly aliases without a second implementation path.
TrainingRun = TrainingResult
collate_batch = collate_training_examples
train = train_profile


__all__ = [
    "OBJECTIVES",
    "PROFILE_SPECS",
    "SPLITS",
    "ProfileSpec",
    "RunTelemetry",
    "StepTelemetry",
    "TrainingBatch",
    "TrainingExample",
    "TrainingExampleLike",
    "TrainingResult",
    "TrainingRun",
    "ValidationTelemetry",
    "collate_batch",
    "collate_training_examples",
    "learning_rate_for_step",
    "model_kind_for_profile",
    "objective_for_profile",
    "profile_spec",
    "train",
    "train_model",
    "train_profile",
    "training_data_sha256",
]
