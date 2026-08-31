from __future__ import annotations

import torch

from digit_lm.config import ModelConfig
from digit_lm.model import DigitTransformer


def test_model_has_ten_input_embeddings_and_ten_output_logits() -> None:
    model = DigitTransformer(ModelConfig())
    assert model.token_embedding.num_embeddings == 10
    assert model.lm_head.out_features == 10
    output = model(torch.tensor([[1, 2, 3]], dtype=torch.long), capture=True)
    assert output.logits.shape == (1, 3, 10)
    assert output.trace is not None


def test_future_token_cannot_change_an_earlier_logit() -> None:
    torch.manual_seed(1)
    model = DigitTransformer(ModelConfig(dropout=0.0)).eval()
    first = model(torch.tensor([[2, 3]], dtype=torch.long)).logits
    second = model(torch.tensor([[2, 9]], dtype=torch.long)).logits
    torch.testing.assert_close(first[:, 0], second[:, 0], rtol=0, atol=0)


def test_attention_is_causal_and_rows_sum_to_one() -> None:
    model = DigitTransformer(ModelConfig()).eval()
    output = model(torch.tensor([[1, 2, 3]], dtype=torch.long), capture=True)
    assert output.trace is not None
    for layer in output.trace["layers"]:
        weights = layer["attention"]["weights"]
        torch.testing.assert_close(weights.sum(dim=-1), torch.ones_like(weights.sum(dim=-1)))
        assert torch.count_nonzero(torch.triu(weights, diagonal=1)) == 0


def test_single_token_attention_is_mathematically_trivial() -> None:
    model = DigitTransformer(ModelConfig()).eval()
    output = model(torch.tensor([[7]], dtype=torch.long), capture=True)
    assert output.trace is not None
    for layer in output.trace["layers"]:
        weights = layer["attention"]["weights"]
        torch.testing.assert_close(weights, torch.ones_like(weights))


def test_loss_and_gradients_are_finite() -> None:
    model = DigitTransformer(ModelConfig())
    inputs = torch.tensor([[4, 0], [9, 1]], dtype=torch.long)
    targets = torch.tensor([[0, 5], [1, 0]], dtype=torch.long)
    output = model(inputs, targets)
    assert output.loss is not None and torch.isfinite(output.loss)
    output.loss.backward()
    assert all(
        parameter.grad is None or torch.isfinite(parameter.grad).all()
        for parameter in model.parameters()
    )
