from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, ClassVar, cast

import torch
import torch.nn.functional as functional
from torch import Tensor, nn

from reasoning_lab.config import ModelConfig


@dataclass(slots=True)
class LMOutput:
    logits: Tensor
    loss: Tensor | None
    auxiliary_loss: Tensor
    trace: dict[str, Any] | None


def _masked_cross_entropy(
    logits: Tensor,
    targets: Tensor | None,
    loss_mask: Tensor | None,
) -> Tensor | None:
    if targets is None:
        if loss_mask is not None:
            raise ValueError("LOSS_MASK_REQUIRES_TARGETS")
        return None
    if targets.shape != logits.shape[:2]:
        raise ValueError("TARGET_SHAPE_MUST_MATCH_BATCH_AND_TIME")
    if targets.dtype != torch.long:
        raise ValueError("TARGETS_MUST_BE_TORCH_LONG")
    if loss_mask is None:
        selected = torch.ones_like(targets, dtype=torch.bool)
    else:
        if loss_mask.shape != targets.shape:
            raise ValueError("LOSS_MASK_SHAPE_MUST_MATCH_TARGETS")
        selected = loss_mask.to(device=targets.device, dtype=torch.bool)
    if not torch.any(selected):
        # A differentiable zero makes empty masks safe for mixed batches while
        # ensuring that padding outside the mask cannot influence the objective.
        return logits.sum() * 0.0
    return functional.cross_entropy(logits[selected], targets[selected])


class LanguageModel(nn.Module):
    model_kind: ClassVar[str]

    def __init__(self, config: ModelConfig, vocab_size: int) -> None:
        super().__init__()
        if vocab_size <= 1:
            raise ValueError("VOCAB_SIZE_MUST_EXCEED_ONE")
        self.config = config
        self.vocab_size = vocab_size

    def _validate_input_ids(self, input_ids: Tensor) -> tuple[int, int]:
        if input_ids.ndim != 2:
            raise ValueError("INPUT_IDS_MUST_HAVE_SHAPE_BATCH_BY_TIME")
        if input_ids.dtype != torch.long:
            raise ValueError("INPUT_IDS_MUST_BE_TORCH_LONG")
        batch_size, sequence_length = input_ids.shape
        if batch_size == 0 or sequence_length == 0:
            raise ValueError("INPUT_IDS_MUST_NOT_BE_EMPTY")
        if sequence_length > self.config.context_length:
            raise ValueError("CONTEXT_WINDOW_EXCEEDED")
        if torch.any(input_ids < 0) or torch.any(input_ids >= self.vocab_size):
            raise ValueError("INPUT_TOKEN_ID_OUT_OF_VOCABULARY")
        return batch_size, sequence_length

    def parameter_count(self) -> int:
        return sum(parameter.numel() for parameter in self.parameters())

    def active_parameter_count(self) -> int:
        return self.parameter_count()

    @property
    def total_parameters(self) -> int:
        return self.parameter_count()

    @property
    def active_parameters(self) -> int:
        return self.active_parameter_count()

    def parameter_counts(self) -> dict[str, int]:
        return {
            "total": self.parameter_count(),
            "active_estimate": self.active_parameter_count(),
        }

    @staticmethod
    def _initialize_module(module: nn.Module) -> None:
        if isinstance(module, (nn.Embedding, nn.Linear)):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)
            if isinstance(module, nn.Linear) and module.bias is not None:
                nn.init.zeros_(module.bias)


class WindowMLP(LanguageModel):
    """A causal fixed-window MLP baseline with no attention mechanism."""

    model_kind = "window_mlp"

    def __init__(self, config: ModelConfig, vocab_size: int) -> None:
        super().__init__(config, vocab_size)
        self.token_embedding = nn.Embedding(vocab_size, config.d_model)
        self.position_embedding = nn.Embedding(config.context_length, config.d_model)
        self.expand = nn.Linear(config.window_size * config.d_model, config.d_ff)
        self.activation = nn.GELU()
        self.dropout = nn.Dropout(config.dropout)
        self.contract = nn.Linear(config.d_ff, config.d_model)
        self.norm = nn.LayerNorm(config.d_model)
        self.lm_head = nn.Linear(config.d_model, vocab_size, bias=False)
        self.apply(self._initialize_module)

    def forward(
        self,
        input_ids: Tensor,
        targets: Tensor | None = None,
        loss_mask: Tensor | None = None,
        capture: bool = False,
    ) -> LMOutput:
        _, sequence_length = self._validate_input_ids(input_ids)
        positions = torch.arange(sequence_length, device=input_ids.device)
        token_embeddings = self.token_embedding(input_ids)
        position_embeddings = self.position_embedding(positions)[None, :, :]
        embedded = token_embeddings + position_embeddings
        padded = functional.pad(
            embedded,
            (0, 0, self.config.window_size - 1, 0),
            mode="constant",
            value=0.0,
        )
        # Tensor.unfold appends the window dimension after d_model.
        windows = padded.unfold(1, self.config.window_size, 1).permute(0, 1, 3, 2)
        flattened = windows.contiguous().reshape(
            input_ids.shape[0], sequence_length, self.config.window_size * self.config.d_model
        )
        mlp_pre_activation = self.expand(flattened)
        mlp_activation = self.activation(mlp_pre_activation)
        mlp_output = self.contract(self.dropout(mlp_activation))
        hidden = self.norm(mlp_output)
        logits = self.lm_head(hidden)
        loss = _masked_cross_entropy(logits, targets, loss_mask)
        trace = None
        if capture:
            trace = {
                "architecture": self.model_kind,
                "token_embeddings": token_embeddings,
                "position_embeddings": position_embeddings,
                "windows": windows,
                "mlp_pre_activation": mlp_pre_activation,
                "mlp_activation": mlp_activation,
                "mlp_output": mlp_output,
                "final_hidden": hidden,
                "logits": logits,
            }
        return LMOutput(
            logits=logits,
            loss=loss,
            auxiliary_loss=logits.new_zeros(()),
            trace=trace,
        )


class CausalSelfAttention(nn.Module):
    causal_mask: Tensor

    def __init__(self, config: ModelConfig) -> None:
        super().__init__()
        self.n_heads = config.n_heads
        self.head_size = config.d_model // config.n_heads
        self.qkv = nn.Linear(config.d_model, 3 * config.d_model)
        self.output = nn.Linear(config.d_model, config.d_model)
        self.attention_dropout = nn.Dropout(config.dropout)
        self.residual_dropout = nn.Dropout(config.dropout)
        causal_mask = torch.tril(
            torch.ones(config.context_length, config.context_length, dtype=torch.bool)
        )
        self.register_buffer("causal_mask", causal_mask, persistent=False)

    def forward(self, x: Tensor, *, capture: bool) -> tuple[Tensor, dict[str, Tensor] | None]:
        batch_size, sequence_length, model_width = x.shape
        query, key, value = self.qkv(x).chunk(3, dim=-1)

        def split_heads(tensor: Tensor) -> Tensor:
            return tensor.view(batch_size, sequence_length, self.n_heads, self.head_size).transpose(
                1, 2
            )

        query_heads = split_heads(query)
        key_heads = split_heads(key)
        value_heads = split_heads(value)
        scores = query_heads @ key_heads.transpose(-2, -1)
        scores = scores / math.sqrt(self.head_size)
        mask = self.causal_mask[:sequence_length, :sequence_length]
        scores = scores.masked_fill(~mask, float("-inf"))
        attention_weights = functional.softmax(scores, dim=-1)
        dropped_weights = self.attention_dropout(attention_weights)
        attended = dropped_weights @ value_heads
        merged = (
            attended.transpose(1, 2).contiguous().view(batch_size, sequence_length, model_width)
        )
        output = self.residual_dropout(self.output(merged))
        trace = None
        if capture:
            trace = {
                "query": query_heads,
                "key": key_heads,
                "value": value_heads,
                "scores": scores,
                "weights": attention_weights,
                "output": output,
            }
        return output, trace


class DenseFeedForward(nn.Module):
    def __init__(self, config: ModelConfig) -> None:
        super().__init__()
        self.expand = nn.Linear(config.d_model, config.d_ff)
        self.activation = nn.GELU()
        self.contract = nn.Linear(config.d_ff, config.d_model)
        self.dropout = nn.Dropout(config.dropout)

    def forward(self, x: Tensor, *, capture: bool) -> tuple[Tensor, dict[str, Tensor] | None]:
        pre_activation = self.expand(x)
        activation = self.activation(pre_activation)
        output = self.dropout(self.contract(activation))
        trace = None
        if capture:
            trace = {
                "pre_activation": pre_activation,
                "activation": activation,
                "output": output,
            }
        return output, trace


class DenseTransformerBlock(nn.Module):
    def __init__(self, config: ModelConfig) -> None:
        super().__init__()
        self.attention_norm = nn.LayerNorm(config.d_model)
        self.attention = CausalSelfAttention(config)
        self.mlp_norm = nn.LayerNorm(config.d_model)
        self.mlp = DenseFeedForward(config)

    def forward(self, x: Tensor, *, capture: bool) -> tuple[Tensor, dict[str, Any] | None]:
        normalized_for_attention = self.attention_norm(x)
        attention_output, attention_trace = self.attention(
            normalized_for_attention, capture=capture
        )
        after_attention = x + attention_output
        normalized_for_mlp = self.mlp_norm(after_attention)
        mlp_output, mlp_trace = self.mlp(normalized_for_mlp, capture=capture)
        after_mlp = after_attention + mlp_output
        trace = None
        if capture:
            assert attention_trace is not None and mlp_trace is not None
            trace = {
                "normalized_for_attention": normalized_for_attention,
                "attention": attention_trace,
                "after_attention": after_attention,
                "normalized_for_mlp": normalized_for_mlp,
                "mlp": mlp_trace,
                "after_mlp": after_mlp,
            }
        return after_mlp, trace


class DenseTransformer(LanguageModel):
    model_kind = "dense_transformer"

    def __init__(self, config: ModelConfig, vocab_size: int) -> None:
        super().__init__(config, vocab_size)
        self.token_embedding = nn.Embedding(vocab_size, config.d_model)
        self.position_embedding = nn.Embedding(config.context_length, config.d_model)
        self.embedding_dropout = nn.Dropout(config.dropout)
        self.blocks = nn.ModuleList(DenseTransformerBlock(config) for _ in range(config.n_layers))
        self.final_norm = nn.LayerNorm(config.d_model)
        self.lm_head = nn.Linear(config.d_model, vocab_size, bias=False)
        self.apply(self._initialize_module)

    def forward(
        self,
        input_ids: Tensor,
        targets: Tensor | None = None,
        loss_mask: Tensor | None = None,
        capture: bool = False,
    ) -> LMOutput:
        _, sequence_length = self._validate_input_ids(input_ids)
        positions = torch.arange(sequence_length, device=input_ids.device)
        token_embeddings = self.token_embedding(input_ids)
        position_embeddings = self.position_embedding(positions)[None, :, :]
        residual = self.embedding_dropout(token_embeddings + position_embeddings)
        initial_residual = residual
        layer_traces: list[dict[str, Any]] = []
        for block in self.blocks:
            residual, block_trace = block(residual, capture=capture)
            if block_trace is not None:
                layer_traces.append(block_trace)
        final_hidden = self.final_norm(residual)
        logits = self.lm_head(final_hidden)
        loss = _masked_cross_entropy(logits, targets, loss_mask)
        trace = None
        if capture:
            trace = {
                "architecture": self.model_kind,
                "token_embeddings": token_embeddings,
                "position_embeddings": position_embeddings,
                "initial_residual": initial_residual,
                "layers": layer_traces,
                "final_hidden": final_hidden,
                "logits": logits,
            }
        return LMOutput(
            logits=logits,
            loss=loss,
            auxiliary_loss=logits.new_zeros(()),
            trace=trace,
        )


class ExpertMLP(nn.Module):
    def __init__(self, config: ModelConfig) -> None:
        super().__init__()
        self.expand = nn.Linear(config.d_model, config.d_ff)
        self.activation = nn.GELU()
        self.contract = nn.Linear(config.d_ff, config.d_model)
        self.dropout = nn.Dropout(config.dropout)

    def forward(self, x: Tensor) -> tuple[Tensor, Tensor, Tensor]:
        pre_activation = self.expand(x)
        activation = self.activation(pre_activation)
        output = self.dropout(self.contract(activation))
        return output, pre_activation, activation


class TopOneMoE(nn.Module):
    def __init__(self, config: ModelConfig) -> None:
        super().__init__()
        self.config = config
        self.router = nn.Linear(config.d_model, config.n_experts, bias=False)
        self.experts = nn.ModuleList(ExpertMLP(config) for _ in range(config.n_experts))

    def forward(self, x: Tensor, *, capture: bool) -> tuple[Tensor, Tensor, dict[str, Any] | None]:
        batch_size, sequence_length, model_width = x.shape
        router_logits = self.router(x)
        router_probabilities = functional.softmax(router_logits, dim=-1)
        selected_experts = router_probabilities.argmax(dim=-1)
        flat_input = x.reshape(-1, model_width)
        flat_selected = selected_experts.reshape(-1)
        flat_probabilities = router_probabilities.reshape(-1, self.config.n_experts)
        flat_output = torch.zeros_like(flat_input)
        flat_pre_activation = (
            x.new_zeros((flat_input.shape[0], self.config.d_ff)) if capture else None
        )
        flat_activation = x.new_zeros((flat_input.shape[0], self.config.d_ff)) if capture else None

        for expert_index, expert in enumerate(self.experts):
            indices = torch.nonzero(flat_selected == expert_index, as_tuple=False).flatten()
            if indices.numel() == 0:
                continue
            expert_input = flat_input.index_select(0, indices)
            expert_output, pre_activation, activation = expert(expert_input)
            gate = flat_probabilities.index_select(0, indices)[:, expert_index : expert_index + 1]
            flat_output = flat_output.index_copy(0, indices, expert_output * gate)
            if capture:
                assert flat_pre_activation is not None and flat_activation is not None
                flat_pre_activation = flat_pre_activation.index_copy(0, indices, pre_activation)
                flat_activation = flat_activation.index_copy(0, indices, activation)

        selected_one_hot = functional.one_hot(
            selected_experts, num_classes=self.config.n_experts
        ).to(router_probabilities.dtype)
        expert_load = selected_one_hot.mean(dim=(0, 1))
        router_importance = router_probabilities.mean(dim=(0, 1))
        load_balancing_loss = self.config.n_experts * torch.sum(expert_load * router_importance)
        router_z_loss = torch.mean(torch.logsumexp(router_logits, dim=-1).square())
        auxiliary_loss = (
            self.config.router_aux_weight * load_balancing_loss
            + self.config.router_z_weight * router_z_loss
        )
        output = flat_output.reshape(batch_size, sequence_length, model_width)
        trace = None
        if capture:
            assert flat_pre_activation is not None and flat_activation is not None
            trace = {
                "router_logits": router_logits,
                "router_probabilities": router_probabilities,
                "selected_experts": selected_experts,
                "expert_counts": torch.bincount(flat_selected, minlength=self.config.n_experts),
                "expert_load": expert_load,
                "router_importance": router_importance,
                "load_balancing_loss": load_balancing_loss,
                "router_z_loss": router_z_loss,
                "mlp_pre_activation": flat_pre_activation.reshape(
                    batch_size, sequence_length, self.config.d_ff
                ),
                "mlp_activation": flat_activation.reshape(
                    batch_size, sequence_length, self.config.d_ff
                ),
                "mlp_output": output,
            }
        return output, auxiliary_loss, trace


class MoETransformerBlock(nn.Module):
    def __init__(self, config: ModelConfig) -> None:
        super().__init__()
        self.attention_norm = nn.LayerNorm(config.d_model)
        self.attention = CausalSelfAttention(config)
        self.moe_norm = nn.LayerNorm(config.d_model)
        self.moe = TopOneMoE(config)

    def forward(self, x: Tensor, *, capture: bool) -> tuple[Tensor, Tensor, dict[str, Any] | None]:
        normalized_for_attention = self.attention_norm(x)
        attention_output, attention_trace = self.attention(
            normalized_for_attention, capture=capture
        )
        after_attention = x + attention_output
        normalized_for_moe = self.moe_norm(after_attention)
        moe_output, auxiliary_loss, moe_trace = self.moe(normalized_for_moe, capture=capture)
        after_moe = after_attention + moe_output
        trace = None
        if capture:
            assert attention_trace is not None and moe_trace is not None
            trace = {
                "normalized_for_attention": normalized_for_attention,
                "attention": attention_trace,
                "after_attention": after_attention,
                "normalized_for_mlp": normalized_for_moe,
                "moe": moe_trace,
                "mlp": {
                    "pre_activation": moe_trace["mlp_pre_activation"],
                    "activation": moe_trace["mlp_activation"],
                    "output": moe_trace["mlp_output"],
                },
                "after_mlp": after_moe,
            }
        return after_moe, auxiliary_loss, trace


class MoETransformer(LanguageModel):
    model_kind = "moe_transformer"

    def __init__(self, config: ModelConfig, vocab_size: int) -> None:
        super().__init__(config, vocab_size)
        self.token_embedding = nn.Embedding(vocab_size, config.d_model)
        self.position_embedding = nn.Embedding(config.context_length, config.d_model)
        self.embedding_dropout = nn.Dropout(config.dropout)
        self.blocks = nn.ModuleList(MoETransformerBlock(config) for _ in range(config.n_layers))
        self.final_norm = nn.LayerNorm(config.d_model)
        self.lm_head = nn.Linear(config.d_model, vocab_size, bias=False)
        self.apply(self._initialize_module)

    def active_parameter_count(self) -> int:
        total = self.parameter_count()
        expert_total = 0
        for block_module in self.blocks:
            block = cast(MoETransformerBlock, block_module)
            for expert_module in block.moe.experts:
                expert = cast(ExpertMLP, expert_module)
                expert_total += sum(parameter.numel() for parameter in expert.parameters())
        active_experts = expert_total * self.config.top_k // self.config.n_experts
        return total - expert_total + active_experts

    def forward(
        self,
        input_ids: Tensor,
        targets: Tensor | None = None,
        loss_mask: Tensor | None = None,
        capture: bool = False,
    ) -> LMOutput:
        _, sequence_length = self._validate_input_ids(input_ids)
        positions = torch.arange(sequence_length, device=input_ids.device)
        token_embeddings = self.token_embedding(input_ids)
        position_embeddings = self.position_embedding(positions)[None, :, :]
        residual = self.embedding_dropout(token_embeddings + position_embeddings)
        initial_residual = residual
        auxiliary_losses: list[Tensor] = []
        layer_traces: list[dict[str, Any]] = []
        for block in self.blocks:
            residual, block_auxiliary_loss, block_trace = block(residual, capture=capture)
            auxiliary_losses.append(block_auxiliary_loss)
            if block_trace is not None:
                layer_traces.append(block_trace)
        final_hidden = self.final_norm(residual)
        logits = self.lm_head(final_hidden)
        loss = _masked_cross_entropy(logits, targets, loss_mask)
        auxiliary_loss = torch.stack(auxiliary_losses).mean()
        trace = None
        if capture:
            trace = {
                "architecture": self.model_kind,
                "token_embeddings": token_embeddings,
                "position_embeddings": position_embeddings,
                "initial_residual": initial_residual,
                "layers": layer_traces,
                "final_hidden": final_hidden,
                "logits": logits,
                "auxiliary_loss": auxiliary_loss,
            }
        return LMOutput(
            logits=logits,
            loss=loss,
            auxiliary_loss=auxiliary_loss,
            trace=trace,
        )


_MODEL_KIND_ALIASES = {
    "window": "window_mlp",
    "window_mlp": "window_mlp",
    "dense": "dense_transformer",
    "dense_direct": "dense_transformer",
    "dense_scratch": "dense_transformer",
    "dense_transformer": "dense_transformer",
    "moe": "moe_transformer",
    "moe_scratch": "moe_transformer",
    "moe_transformer": "moe_transformer",
}


def canonical_model_kind(kind: str) -> str:
    try:
        return _MODEL_KIND_ALIASES[kind]
    except KeyError as error:
        raise ValueError(f"UNKNOWN_MODEL_KIND: {kind}") from error


def build_model(kind: str, config: ModelConfig, vocab_size: int) -> LanguageModel:
    canonical = canonical_model_kind(kind)
    if canonical == WindowMLP.model_kind:
        return WindowMLP(config, vocab_size)
    if canonical == DenseTransformer.model_kind:
        return DenseTransformer(config, vocab_size)
    if canonical == MoETransformer.model_kind:
        return MoETransformer(config, vocab_size)
    raise AssertionError(f"UNHANDLED_MODEL_KIND: {canonical}")
