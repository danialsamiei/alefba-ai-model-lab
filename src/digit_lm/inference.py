from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

import torch
from torch import Tensor

from digit_lm.model import DigitTransformer
from digit_lm.tokenizer import DigitTokenizer


def _rounded_list(tensor: Tensor, digits: int = 7) -> Any:
    value = tensor.detach().cpu().tolist()

    def round_nested(item: Any) -> Any:
        if isinstance(item, list):
            return [round_nested(child) for child in item]
        if isinstance(item, float):
            return round(item, digits)
        return item

    return round_nested(value)


def _distribution(logits: Tensor) -> tuple[dict[str, float], dict[str, float], float, float]:
    probabilities = torch.softmax(logits, dim=-1)
    entropy = float(-(probabilities * probabilities.clamp_min(1e-12).log()).sum().item())
    top_two = torch.topk(probabilities, k=2).values
    margin = float((top_two[0] - top_two[1]).item())
    return (
        {str(index): round(float(value), 7) for index, value in enumerate(logits.tolist())},
        {str(index): round(float(value), 7) for index, value in enumerate(probabilities.tolist())},
        entropy,
        margin,
    )


def _embedding_gradient(model: DigitTransformer, input_ids: Tensor, chosen: int) -> Tensor:
    model.zero_grad(set_to_none=True)
    embedded = model.token_embedding(input_ids).detach().clone().requires_grad_(True)
    output = model(input_ids, token_embeddings_override=embedded)
    chosen_logit = output.logits[0, -1, chosen]
    gradient = torch.autograd.grad(chosen_logit, embedded, retain_graph=False)[0]
    if not isinstance(gradient, Tensor):
        raise TypeError("AUTOGRAD_DID_NOT_RETURN_A_TENSOR")
    return gradient


@torch.inference_mode()
def _logit_lens(
    model: DigitTransformer, residuals: list[tuple[str, Tensor, bool]]
) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for label, residual, already_normalized in residuals:
        projected_hidden = residual if already_normalized else model.final_norm(residual)
        lens_logits = model.lm_head(projected_hidden)[0, -1]
        _, probabilities, entropy, _ = _distribution(lens_logits)
        result.append(
            {
                "stage": label,
                "probabilities": probabilities,
                "entropy": round(entropy, 7),
                "argmax": str(int(lens_logits.argmax().item())),
            }
        )
    return result


def predict_next_token(
    model: DigitTransformer,
    tokenizer: DigitTokenizer,
    context_ids: list[int],
    *,
    include_trace: bool,
) -> dict[str, Any]:
    input_tensor = torch.tensor([context_ids], dtype=torch.long)
    model.eval()
    with torch.inference_mode():
        output = model(input_tensor, capture=include_trace)
        last_logits = output.logits[0, -1]
        chosen = int(last_logits.argmax().item())
        logits, probabilities, entropy, margin = _distribution(last_logits)
    step: dict[str, Any] = {
        "context": tokenizer.decode(context_ids),
        # The autoregressive loop appends to its context; the trace must preserve this step.
        "context_ids": list(context_ids),
        "predicted_token": tokenizer.decode([chosen]),
        "predicted_id": chosen,
        "logits": logits,
        "probabilities": probabilities,
        "entropy": round(entropy, 7),
        "top2_probability_margin": round(margin, 7),
    }
    if not include_trace:
        return step

    assert output.trace is not None
    trace = output.trace
    final_hidden = trace["final_hidden"][0, -1].detach().clone()
    contributions = final_hidden * model.lm_head.weight[chosen].detach()
    ranked_dimensions = torch.argsort(contributions.abs(), descending=True)[:8].tolist()
    residuals: list[tuple[str, Tensor, bool]] = [
        ("embedding_plus_position", trace["initial_residual"], False)
    ]
    layer_details: list[dict[str, Any]] = []
    for index, layer in enumerate(trace["layers"]):
        residuals.append((f"after_block_{index}", layer["after_mlp"], False))
        attention = layer["attention"]
        assert attention is not None
        layer_details.append(
            {
                "layer": index,
                "attention_weights": _rounded_list(attention["weights"][0]),
                "attention_scores_before_mask": _rounded_list(attention["scores_before_mask"][0]),
                "causal_mask": _rounded_list(attention["causal_mask"]),
                "query": _rounded_list(attention["query"][0]),
                "key": _rounded_list(attention["key"][0]),
                "value": _rounded_list(attention["value"][0]),
                "mlp_pre_activation": _rounded_list(layer["mlp_pre_activation"][0]),
                "mlp_activation": _rounded_list(layer["mlp_activation"][0]),
                "mlp_output": _rounded_list(layer["mlp_output"][0]),
                "residual_after_block": _rounded_list(layer["after_mlp"][0]),
            }
        )
    residuals.append(("final", trace["final_hidden"], True))
    gradient = _embedding_gradient(model, input_tensor, chosen)
    step["trace"] = {
        "token_embeddings": _rounded_list(trace["token_embeddings"][0]),
        "position_embeddings": _rounded_list(trace["position_embeddings"][0]),
        "initial_residual": _rounded_list(trace["initial_residual"][0]),
        "layers": layer_details,
        "final_hidden": _rounded_list(final_hidden),
        "input_embedding_gradient": _rounded_list(gradient[0]),
        "logit_lens": _logit_lens(model, residuals),
        "chosen_logit_contributions": {
            "sum": round(float(contributions.sum().item()), 7),
            "direct_logit": logits[str(chosen)],
            "top_dimensions": [
                {
                    "dimension": int(dimension),
                    "contribution": round(float(contributions[dimension].item()), 7),
                }
                for dimension in ranked_dimensions
            ],
        },
    }
    return step


@dataclass(slots=True)
class InferenceService:
    model: DigitTransformer
    metadata: dict[str, Any]
    tokenizer: DigitTokenizer = field(default_factory=DigitTokenizer)

    def generate_successor(self, digit: str, *, include_trace: bool = True) -> dict[str, Any]:
        prompt_id = self.tokenizer.encode_one(digit)
        context = [prompt_id]
        generated: list[int] = []
        steps: list[dict[str, Any]] = []
        for _ in range(2):
            step = predict_next_token(
                self.model, self.tokenizer, context, include_trace=include_trace
            )
            next_id = int(step["predicted_id"])
            generated.append(next_id)
            context.append(next_id)
            steps.append(step)
        raw_output = self.tokenizer.decode(generated)
        # Post-generation evaluator only: it never feeds a token, logit, or branch back to generation.
        expected_raw = f"{int(digit) + 1:02d}"
        return {
            "input": digit,
            "input_id": prompt_id,
            "raw_output": raw_output,
            "display_output": str(int(raw_output)),
            "expected_raw": expected_raw,
            "expected_display": str(int(expected_raw)),
            "correct": raw_output == expected_raw,
            "post_generation_oracle": {
                "expected_raw": expected_raw,
                "correct": raw_output == expected_raw,
                "used_for_generation": False,
            },
            "generation_protocol": "exactly_two_tokens_without_eos",
            "steps": steps,
            "run_id": self.metadata.get("run_id"),
            "stage": self.metadata.get("stage"),
            "checkpoint_sha256": self.metadata.get("checkpoint_sha256"),
            "tensor_sha256": self.metadata.get("tensor_sha256"),
        }

    def inspect_context(self, context: str, *, include_trace: bool = True) -> dict[str, Any]:
        context_ids = self.tokenizer.encode(context)
        if len(context_ids) > self.model.config.context_length:
            raise ValueError("CONTEXT_WINDOW_EXCEEDED")
        return predict_next_token(
            self.model, self.tokenizer, context_ids, include_trace=include_trace
        )


def mean_step_entropy(prediction: dict[str, Any]) -> float:
    entropies = [float(step["entropy"]) for step in prediction["steps"]]
    return float(sum(entropies) / max(1, len(entropies)))


def uniform_entropy() -> float:
    return math.log(10.0)
