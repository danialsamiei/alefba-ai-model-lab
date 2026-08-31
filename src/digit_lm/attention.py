from __future__ import annotations

import math
from typing import Any

import torch
from torch import Tensor, nn

from digit_lm.config import ModelConfig


class CausalSelfAttention(nn.Module):
    """Multi-head attention written out explicitly so every matrix is inspectable."""

    causal_mask: Tensor

    def __init__(self, config: ModelConfig) -> None:
        super().__init__()
        self.n_heads = config.n_heads
        self.head_size = config.d_model // config.n_heads
        self.qkv = nn.Linear(config.d_model, 3 * config.d_model)
        self.output = nn.Linear(config.d_model, config.d_model)
        self.dropout = nn.Dropout(config.dropout)
        mask = torch.tril(
            torch.ones(config.context_length, config.context_length, dtype=torch.bool)
        )
        self.register_buffer("causal_mask", mask, persistent=True)

    def forward(self, x: Tensor, *, capture: bool = False) -> tuple[Tensor, dict[str, Any] | None]:
        batch_size, sequence_length, model_width = x.shape
        qkv = self.qkv(x)
        query, key, value = qkv.chunk(3, dim=-1)

        def split_heads(tensor: Tensor) -> Tensor:
            return tensor.view(batch_size, sequence_length, self.n_heads, self.head_size).transpose(
                1, 2
            )

        query = split_heads(query)
        key = split_heads(key)
        value = split_heads(value)
        scores = query @ key.transpose(-2, -1) / math.sqrt(self.head_size)
        visible = self.causal_mask[:sequence_length, :sequence_length]
        masked_scores = scores.masked_fill(~visible, torch.finfo(scores.dtype).min)
        weights = torch.softmax(masked_scores, dim=-1)
        attended = self.dropout(weights) @ value
        merged = (
            attended.transpose(1, 2).contiguous().view(batch_size, sequence_length, model_width)
        )
        projected = self.output(merged)
        if not capture:
            return projected, None
        return projected, {
            "query": query,
            "key": key,
            "value": value,
            "scores_before_mask": scores,
            "causal_mask": visible,
            "weights": weights,
            "head_output": attended,
            "merged_output": merged,
            "projected_output": projected,
        }
