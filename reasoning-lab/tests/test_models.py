from __future__ import annotations

import json
from pathlib import Path

import pytest
import torch

from reasoning_lab.checkpoint import load_checkpoint, save_checkpoint
from reasoning_lab.config import ModelConfig, load_project_config
from reasoning_lab.models import (
    DenseTransformer,
    MoETransformer,
    WindowMLP,
    build_model,
)


def tiny_config(*, window_size: int = 3) -> ModelConfig:
    return ModelConfig(
        context_length=8,
        d_model=16,
        n_heads=4,
        n_layers=2,
        d_ff=32,
        dropout=0.0,
        window_size=window_size,
        n_experts=4,
        top_k=1,
        router_aux_weight=0.01,
        router_z_weight=0.001,
    )


def test_current_toml_loads_every_config_section() -> None:
    project_root = Path(__file__).resolve().parents[1]
    config = load_project_config(project_root / "configs" / "lab.toml")
    assert config.model.context_length == 160
    assert config.model.n_experts == 4
    assert config.data.ood_depth > config.data.train_max_depth
    assert config.training_for("moe_scratch").steps == 1000
    assert config.lab.body_limit_bytes == 16384


@pytest.mark.parametrize(
    ("kind", "expected_type"),
    [
        ("window_mlp", WindowMLP),
        ("dense_transformer", DenseTransformer),
        ("moe_transformer", MoETransformer),
    ],
)
def test_models_share_shapes_and_loss_ignores_everything_outside_mask(
    kind: str, expected_type: type[WindowMLP | DenseTransformer | MoETransformer]
) -> None:
    torch.manual_seed(7)
    model = build_model(kind, tiny_config(), vocab_size=23).eval()
    assert isinstance(model, expected_type)
    input_ids = torch.tensor([[1, 2, 3, 0]], dtype=torch.long)
    mask = torch.tensor([[True, True, False, False]])
    first_targets = torch.tensor([[3, 4, 0, 0]], dtype=torch.long)
    changed_padding = torch.tensor([[3, 4, 999, -17]], dtype=torch.long)
    first = model(input_ids, first_targets, mask)
    second = model(input_ids, changed_padding, mask)
    assert first.logits.shape == (1, 4, 23)
    assert first.loss is not None and torch.isfinite(first.loss)
    assert second.loss is not None
    torch.testing.assert_close(first.loss, second.loss, rtol=0, atol=0)
    assert first.auxiliary_loss.ndim == 0


@pytest.mark.parametrize("kind", ["dense_transformer", "moe_transformer"])
def test_transformer_is_strictly_causal(kind: str) -> None:
    torch.manual_seed(11)
    model = build_model(kind, tiny_config(), vocab_size=23).eval()
    first = model(torch.tensor([[1, 2, 3, 4]], dtype=torch.long)).logits
    changed_future = model(torch.tensor([[1, 2, 9, 8]], dtype=torch.long)).logits
    # Sparse MoE dispatch can change the matrix kernel's batch shape when future
    # tokens choose another expert, producing only float32 rounding noise.
    torch.testing.assert_close(first[:, :2], changed_future[:, :2], rtol=1e-6, atol=2e-8)


def test_dense_trace_exposes_qkv_attention_residual_and_mlp() -> None:
    model = DenseTransformer(tiny_config(), vocab_size=23).eval()
    output = model(torch.tensor([[1, 2, 3, 4]], dtype=torch.long), capture=True)
    assert output.trace is not None
    assert len(output.trace["layers"]) == 2
    for layer in output.trace["layers"]:
        attention = layer["attention"]
        assert attention["query"].shape == (1, 4, 4, 4)
        assert attention["key"].shape == attention["query"].shape
        assert attention["value"].shape == attention["query"].shape
        weights = attention["weights"]
        torch.testing.assert_close(weights.sum(dim=-1), torch.ones_like(weights.sum(dim=-1)))
        assert torch.count_nonzero(torch.triu(weights, diagonal=1)) == 0
        assert layer["after_attention"].shape == (1, 4, 16)
        assert layer["mlp"]["pre_activation"].shape == (1, 4, 32)
        assert layer["after_mlp"].shape == (1, 4, 16)


def test_window_mlp_cannot_see_tokens_older_than_its_window() -> None:
    model = WindowMLP(tiny_config(window_size=2), vocab_size=23).eval()
    first = model(torch.tensor([[1, 2, 3, 4]], dtype=torch.long)).logits
    changed_old_token = model(torch.tensor([[9, 2, 3, 4]], dtype=torch.long)).logits
    torch.testing.assert_close(first[:, -1], changed_old_token[:, -1], rtol=0, atol=0)


def test_moe_routes_every_token_top_one_and_reports_active_capacity() -> None:
    torch.manual_seed(13)
    model = MoETransformer(tiny_config(), vocab_size=23)
    input_ids = torch.tensor([[1, 2, 3, 4], [5, 6, 7, 8]], dtype=torch.long)
    targets = torch.tensor([[2, 3, 4, 5], [6, 7, 8, 9]], dtype=torch.long)
    output = model(input_ids, targets, torch.ones_like(targets, dtype=torch.bool), capture=True)
    assert output.loss is not None
    assert torch.isfinite(output.auxiliary_loss)
    assert output.auxiliary_loss.item() > 0.0
    assert output.trace is not None
    for layer in output.trace["layers"]:
        router = layer["moe"]
        probabilities = router["router_probabilities"]
        torch.testing.assert_close(
            probabilities.sum(dim=-1), torch.ones_like(probabilities.sum(dim=-1))
        )
        assert router["selected_experts"].shape == input_ids.shape
        assert int(router["expert_counts"].sum().item()) == input_ids.numel()
        assert router["expert_counts"].shape == (4,)
        assert layer["mlp"]["pre_activation"].shape == (2, 4, 32)
    (output.loss + output.auxiliary_loss).backward()
    router_weights = [
        parameter
        for name, parameter in model.named_parameters()
        if name.endswith("moe.router.weight")
    ]
    assert router_weights
    assert all(parameter.grad is not None for parameter in router_weights)
    assert model.active_parameter_count() < model.parameter_count()
    assert model.parameter_counts() == {
        "total": model.parameter_count(),
        "active_estimate": model.active_parameter_count(),
    }


@pytest.mark.parametrize("kind", ["window_mlp", "dense_transformer", "moe_transformer"])
def test_safetensors_checkpoint_round_trip_is_dynamic_and_exact(kind: str, tmp_path: Path) -> None:
    torch.manual_seed(17)
    model = build_model(kind, tiny_config(), vocab_size=23).eval()
    checkpoint_dir = tmp_path / kind
    metadata = save_checkpoint(
        checkpoint_dir,
        model=model,
        metadata={"run_id": f"run-{kind}", "stage": "unit-test"},
    )
    loaded = load_checkpoint(checkpoint_dir)
    assert loaded.metadata == metadata
    assert loaded.metadata["model_kind"] == kind
    assert loaded.metadata["parameter_counts"] == model.parameter_counts()
    input_ids = torch.tensor([[1, 2, 3, 4]], dtype=torch.long)
    torch.testing.assert_close(
        model(input_ids).logits,
        loaded.model(input_ids).logits,
        rtol=0,
        atol=0,
    )


def test_checkpoint_rejects_tampered_provenance_sidecar(tmp_path: Path) -> None:
    checkpoint_dir = tmp_path / "checkpoint"
    save_checkpoint(
        checkpoint_dir,
        model=DenseTransformer(tiny_config(), vocab_size=23),
        metadata={"run_id": "original"},
    )
    sidecar_path = checkpoint_dir / "checkpoint.json"
    sidecar = json.loads(sidecar_path.read_text(encoding="utf-8"))
    sidecar["run_id"] = "forged"
    sidecar_path.write_text(json.dumps(sidecar), encoding="utf-8")
    with pytest.raises(ValueError, match="CHECKPOINT_METADATA_SHA256_MISMATCH"):
        load_checkpoint(checkpoint_dir)
