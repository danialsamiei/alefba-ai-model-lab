from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import torch
import torch.nn.functional as functional
from torch import Tensor, nn

from digit_lm.attention import CausalSelfAttention
from digit_lm.config import ModelConfig


@dataclass(slots=True)
class ModelOutput:
    logits: Tensor
    loss: Tensor | None
    trace: dict[str, Any] | None


class TransformerBlock(nn.Module):
    def __init__(self, config: ModelConfig) -> None:
        super().__init__()
        self.attention_norm = nn.LayerNorm(config.d_model)
        self.attention = CausalSelfAttention(config)
        self.mlp_norm = nn.LayerNorm(config.d_model)
        self.mlp_expand = nn.Linear(config.d_model, config.d_ff)
        self.mlp_activation = nn.GELU()
        self.mlp_contract = nn.Linear(config.d_ff, config.d_model)
        self.mlp_dropout = nn.Dropout(config.dropout)

    def forward(self, x: Tensor, *, capture: bool = False) -> tuple[Tensor, dict[str, Any] | None]:
        normalized_for_attention = self.attention_norm(x)
        attention_output, attention_trace = self.attention(
            normalized_for_attention, capture=capture
        )
        after_attention = x + attention_output
        normalized_for_mlp = self.mlp_norm(after_attention)
        mlp_pre_activation = self.mlp_expand(normalized_for_mlp)
        mlp_activation = self.mlp_activation(mlp_pre_activation)
        mlp_output = self.mlp_dropout(self.mlp_contract(mlp_activation))
        after_mlp = after_attention + mlp_output
        if not capture:
            return after_mlp, None
        return after_mlp, {
            "normalized_for_attention": normalized_for_attention,
            "attention": attention_trace,
            "after_attention": after_attention,
            "normalized_for_mlp": normalized_for_mlp,
            "mlp_pre_activation": mlp_pre_activation,
            "mlp_activation": mlp_activation,
            "mlp_output": mlp_output,
            "after_mlp": after_mlp,
        }


class DigitTransformer(nn.Module):
    """A decoder-only Transformer whose input and output dimensions are exactly ten."""

    def __init__(self, config: ModelConfig) -> None:
        super().__init__()
        self.config = config
        self.token_embedding = nn.Embedding(config.vocab_size, config.d_model)
        self.position_embedding = nn.Embedding(config.context_length, config.d_model)
        self.blocks = nn.ModuleList([TransformerBlock(config) for _ in range(config.n_layers)])
        self.final_norm = nn.LayerNorm(config.d_model)
        self.lm_head = nn.Linear(config.d_model, config.vocab_size, bias=False)
        self.apply(self._initialize_module)

    @staticmethod
    def _initialize_module(module: nn.Module) -> None:
        if isinstance(module, (nn.Linear, nn.Embedding)):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)
            if isinstance(module, nn.Linear) and module.bias is not None:
                nn.init.zeros_(module.bias)

    def parameter_count(self) -> int:
        return sum(parameter.numel() for parameter in self.parameters())

    def forward(
        self,
        input_ids: Tensor,
        targets: Tensor | None = None,
        *,
        capture: bool = False,
        token_embeddings_override: Tensor | None = None,
    ) -> ModelOutput:
        if input_ids.ndim != 2:
            raise ValueError("INPUT_IDS_MUST_HAVE_SHAPE_BATCH_BY_TIME")
        _, sequence_length = input_ids.shape
        if sequence_length > self.config.context_length:
            raise ValueError("CONTEXT_WINDOW_EXCEEDED")
        if input_ids.dtype != torch.long:
            raise ValueError("INPUT_IDS_MUST_BE_TORCH_LONG")

        positions = torch.arange(sequence_length, device=input_ids.device)
        token_vectors = (
            token_embeddings_override
            if token_embeddings_override is not None
            else self.token_embedding(input_ids)
        )
        position_vectors = self.position_embedding(positions)[None, :, :]
        residual = token_vectors + position_vectors
        layer_traces: list[dict[str, Any]] = []
        initial_residual = residual
        for block in self.blocks:
            residual, block_trace = block(residual, capture=capture)
            if block_trace is not None:
                layer_traces.append(block_trace)
        final_hidden = self.final_norm(residual)
        logits = self.lm_head(final_hidden)
        loss = None
        if targets is not None:
            if targets.shape != input_ids.shape:
                raise ValueError("TARGET_SHAPE_MUST_MATCH_INPUT_SHAPE")
            loss = functional.cross_entropy(
                logits.reshape(-1, self.config.vocab_size), targets.reshape(-1)
            )
        trace = None
        if capture:
            trace = {
                "token_embeddings": token_vectors,
                "position_embeddings": position_vectors,
                "initial_residual": initial_residual,
                "layers": layer_traces,
                "final_hidden": final_hidden,
                "logits": logits,
            }
        return ModelOutput(logits=logits, loss=loss, trace=trace)
