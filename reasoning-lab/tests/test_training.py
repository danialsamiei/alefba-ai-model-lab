from __future__ import annotations

import json
from pathlib import Path

import pytest
import torch

from reasoning_lab.baselines import NGramLanguageModel
from reasoning_lab.checkpoint import load_checkpoint
from reasoning_lab.config import DataConfig, LabConfig, ModelConfig, ProjectConfig, TrainConfig
from reasoning_lab.data import TrainingExample as CurriculumTrainingExample
from reasoning_lab.models import build_model
from reasoning_lab.training import (
    TrainingExample,
    collate_training_examples,
    learning_rate_for_step,
    model_kind_for_profile,
    objective_for_profile,
    train_model,
    train_profile,
)


def tiny_model_config() -> ModelConfig:
    return ModelConfig(
        context_length=8,
        d_model=8,
        n_heads=2,
        n_layers=1,
        d_ff=16,
        dropout=0.0,
        window_size=2,
        n_experts=4,
        top_k=1,
        router_aux_weight=0.01,
        router_z_weight=0.001,
    )


def tiny_train_config(*, steps: int = 3) -> TrainConfig:
    return TrainConfig(
        steps=steps,
        batch_size=2,
        learning_rate=0.02,
        min_learning_rate=0.002,
        warmup_steps=1,
        eval_interval=2,
        weight_decay=0.01,
        gradient_clip=1.0,
    )


def tiny_project_config() -> ProjectConfig:
    training = tiny_train_config()
    return ProjectConfig(
        model=tiny_model_config(),
        data=DataConfig(
            seed=7,
            train_episodes=2,
            validation_episodes=1,
            iid_test_episodes=1,
            depth_ood_episodes=1,
            rag_holdout_episodes=1,
            train_max_depth=1,
            ood_depth=2,
            max_distractors=0,
        ),
        window_mlp_train=training,
        dense_direct_train=training,
        dense_scratch_train=training,
        moe_scratch_train=training,
        lab=LabConfig(seed=41, evaluation_limit_per_split=1, body_limit_bytes=1024),
    )


def example(
    episode_id: str,
    token_ids: tuple[int, ...],
    *,
    objective: str = "direct",
    split: str = "train",
) -> TrainingExample:
    return TrainingExample(
        token_ids=token_ids,
        loss_mask=(False,) * (len(token_ids) - 2) + (True, True),
        objective=objective,
        split=split,
        episode_id=episode_id,
        metadata={"fixture": True},
    )


def test_ngram_counts_backoff_generation_and_deterministic_round_trip(tmp_path: Path) -> None:
    model = NGramLanguageModel(order=2, vocab_size=6).fit([(0, 1, 2), (0, 1, 3), (4, 1, 2)])
    assert model.next_token_counts([1]) == {2: 2, 3: 1}
    assert model.predict_next([1]) == 2
    assert model.predict_next([5]) == 1  # unseen bigram backs off to the unigram mode
    assert model.generate([0], 3) == (0, 1, 2, 1)
    assert model.generate([0], 3, stop_token_id=2, include_prompt=False) == (1, 2)

    first_path = tmp_path / "first.json"
    second_path = tmp_path / "second.json"
    first_metadata = model.save(first_path)
    second_metadata = model.save(second_path)
    assert first_metadata == second_metadata
    assert first_path.read_bytes() == second_path.read_bytes()
    loaded = NGramLanguageModel.load(first_path)
    assert loaded.model_sha256 == model.model_sha256
    assert loaded.generate([0], 3) == model.generate([0], 3)


def test_ngram_tie_break_and_hash_tamper_detection(tmp_path: Path) -> None:
    model = NGramLanguageModel(order=2, vocab_size=4).fit([(0, 2), (0, 1)])
    assert model.predict_next([0]) == 1
    path = tmp_path / "ngram.json"
    model.save(path)
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["order"] = 3
    path.write_text(json.dumps(payload), encoding="utf-8")
    with pytest.raises(ValueError, match="SHA256_MISMATCH"):
        NGramLanguageModel.load(path)
    with pytest.raises(RuntimeError, match="NO_OBSERVATIONS"):
        NGramLanguageModel(order=2, vocab_size=4).save(tmp_path / "empty.json")


def test_collation_applies_next_token_shift_and_boolean_padding_mask() -> None:
    examples = (
        TrainingExample(
            token_ids=(1, 2, 3),
            loss_mask=(False, False, True),
            objective="direct",
            split="train",
            episode_id="a",
        ),
        TrainingExample(
            token_ids=(4, 5),
            loss_mask=(False, True),
            objective="direct",
            split="train",
            episode_id="b",
        ),
    )
    batch = collate_training_examples(examples, pad_token_id=0)
    assert batch.input_ids.tolist() == [[1, 2], [4, 0]]
    assert batch.targets.tolist() == [[2, 3], [5, 0]]
    assert batch.loss_mask.tolist() == [[False, True], [True, False]]
    assert batch.loss_mask.dtype == torch.bool
    assert batch.sequence_lengths.tolist() == [2, 1]
    assert batch.supervised_tokens == 2


def test_collation_accepts_curriculum_training_example_protocol() -> None:
    curriculum_example = CurriculumTrainingExample(
        token_ids=(1, 2, 3),
        loss_mask=(False, False, True),
        objective="direct",
        split="train",
        episode_id="curriculum-a",
        metadata={},
    )
    batch = collate_training_examples((curriculum_example,), pad_token_id=0)
    assert batch.input_ids.tolist() == [[1, 2]]
    assert batch.targets.tolist() == [[2, 3]]
    assert batch.loss_mask.tolist() == [[False, True]]


def test_profile_mapping_and_warmup_cosine_schedule() -> None:
    assert objective_for_profile("window_mlp") == "direct"
    assert objective_for_profile("direct") == "direct"
    assert objective_for_profile("scratch") == "scratch"
    assert objective_for_profile("moe") == "scratch"
    assert model_kind_for_profile("direct") == "dense_transformer"
    assert model_kind_for_profile("moe") == "moe_transformer"
    config = TrainConfig(
        steps=4,
        batch_size=1,
        learning_rate=1.0,
        min_learning_rate=0.1,
        warmup_steps=2,
        eval_interval=1,
        weight_decay=0.0,
        gradient_clip=1.0,
    )
    assert learning_rate_for_step(config, 1) == pytest.approx(0.5)
    assert learning_rate_for_step(config, 2) == pytest.approx(1.0)
    assert learning_rate_for_step(config, 3) == pytest.approx(1.0)
    assert learning_rate_for_step(config, 4) == pytest.approx(0.1)


def test_profile_training_is_reproducible_and_saves_safe_checkpoint(tmp_path: Path) -> None:
    examples = (
        example("train-a", (1, 2, 3, 4)),
        example("train-b", (1, 3, 4)),
        example("validation-a", (1, 2, 4), split="validation"),
        example("ignored-scratch", (1, 5, 6), objective="scratch"),
    )
    config = tiny_project_config()
    first = train_profile(
        "window_mlp",
        config,
        examples,
        vocab_size=8,
        pad_token_id=0,
        checkpoint_dir=tmp_path / "checkpoint",
        checkpoint_metadata={"run_id": "unit-test"},
    )
    second = train_profile(
        "window_mlp",
        config,
        examples,
        vocab_size=8,
        pad_token_id=0,
    )
    for name, tensor in first.model.state_dict().items():
        torch.testing.assert_close(tensor, second.model.state_dict()[name], rtol=0, atol=0)
    assert len(first.telemetry.steps) == 3
    assert [item.step for item in first.telemetry.validations] == [2, 3]
    assert first.telemetry.training_data_sha256 == second.telemetry.training_data_sha256
    assert first.telemetry.train_example_count == 2
    assert first.telemetry.validation_example_count == 1
    assert first.checkpoint_metadata is not None
    assert first.checkpoint_metadata["training_profile"] == "window_mlp"
    assert first.checkpoint_metadata["training_objective"] == "direct"
    loaded = load_checkpoint(tmp_path / "checkpoint")
    assert loaded.metadata == first.checkpoint_metadata
    for name, tensor in first.model.state_dict().items():
        torch.testing.assert_close(tensor, loaded.model.state_dict()[name], rtol=0, atol=0)


def test_moe_training_optimizes_and_reports_auxiliary_loss() -> None:
    torch.manual_seed(9)
    model = build_model("moe_transformer", tiny_model_config(), vocab_size=8)
    result = train_model(
        model,
        (example("scratch-a", (1, 2, 3), objective="scratch"),),
        profile="moe",
        config=tiny_train_config(steps=1),
        pad_token_id=0,
        seed=9,
    )
    step = result.telemetry.steps[0]
    assert step.auxiliary_loss > 0.0
    assert step.total_loss == pytest.approx(step.token_loss + step.auxiliary_loss)
    router_parameters = [
        parameter
        for name, parameter in result.model.named_parameters()
        if name.endswith("moe.router.weight")
    ]
    assert router_parameters
    assert all(parameter.grad is not None for parameter in router_parameters)
