"""Autoregressive inference, test-time budgets, verification, and telemetry.

The module exposes generated scratchpads only.  It does not claim access to a
model's private or hidden reasoning state.  Candidate selection is an explicit
host-side inference policy and is counted separately from neural forward passes.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from time import perf_counter
from typing import Any, Literal

import torch
from torch import Tensor

from reasoning_lab.models import LanguageModel
from reasoning_lab.task import (
    BinaryOperation,
    Expr,
    Variable,
    parse_expression,
    validate_bindings,
    variables_in,
)
from reasoning_lab.tokenizer import (
    BOS_TOKEN,
    EOT_TOKEN,
    FINAL_TOKEN,
    PROMPT_TOKEN,
    SCRATCH_TOKEN,
    FixedTokenizer,
    get_tokenizer,
)

Effort = Literal["low", "medium", "high"]
Objective = Literal["direct", "scratch"]


@dataclass(frozen=True, slots=True)
class EffortPolicy:
    name: Effort
    candidates: int
    max_scratch_tokens: int
    temperature: float
    top_k: int
    verifier_passes: int


EFFORT_POLICIES: dict[Effort, EffortPolicy] = {
    "low": EffortPolicy("low", 1, 64, 0.0, 1, 1),
    "medium": EffortPolicy("medium", 4, 80, 0.75, 8, 1),
    "high": EffortPolicy("high", 8, 112, 0.95, 12, 1),
}


@dataclass(frozen=True, slots=True)
class TokenStep:
    position: int
    token_id: int
    token_text: str
    logprob: float
    top_probabilities: tuple[tuple[str, float], ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "position": self.position,
            "token_id": self.token_id,
            "token_text": self.token_text,
            "logprob": self.logprob,
            "top_probabilities": [
                {"token": token, "probability": probability}
                for token, probability in self.top_probabilities
            ],
        }


@dataclass(slots=True)
class Candidate:
    output_text: str
    final_answer: int | None
    scratchpad: str | None
    trace_steps: tuple[str, ...]
    normalized_logprob: float
    protocol_valid: bool
    verifier_score: float
    generated_tokens: int
    forward_passes: int
    token_steps: tuple[TokenStep, ...]
    model_sequence: tuple[int, ...]
    host_framing_tokens: int = 0
    selected: bool = False
    incomplete_budget: bool = False

    def summary(self) -> dict[str, Any]:
        return {
            "output_text": self.output_text,
            "final_answer": self.final_answer,
            "normalized_logprob": self.normalized_logprob,
            "protocol_valid": self.protocol_valid,
            "verifier_score": self.verifier_score,
            "generated_tokens": self.generated_tokens,
            "forward_passes": self.forward_passes,
            "selected": self.selected,
            "metadata": {
                "incomplete_budget": self.incomplete_budget,
                "host_framing_tokens": self.host_framing_tokens,
                "decoding_strategy": (
                    "grammar_constrained_slots"
                    if self.scratchpad is not None
                    else "digit_constrained"
                ),
            },
        }


@dataclass(slots=True)
class InferenceResult:
    answer: int | None
    output_text: str
    scratchpad: str | None
    trace_steps: tuple[str, ...]
    protocol_valid: bool
    effort: Effort
    candidates: tuple[Candidate, ...]
    selected_index: int
    elapsed_ms: float
    total_generated_tokens: int
    total_forward_passes: int
    verifier_passes: int
    total_host_framing_tokens: int
    token_steps: tuple[TokenStep, ...]
    attention: list[list[float]] | None = None
    routing: list[dict[str, Any]] = field(default_factory=list)
    visual_trace: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "answer": self.answer,
            "output_text": self.output_text,
            "scratchpad": self.scratchpad,
            "trace_steps": list(self.trace_steps),
            "protocol_valid": self.protocol_valid,
            "effort": self.effort,
            "candidates": [candidate.summary() for candidate in self.candidates],
            "selected_index": self.selected_index,
            "elapsed_ms": self.elapsed_ms,
            "total_generated_tokens": self.total_generated_tokens,
            "total_forward_passes": self.total_forward_passes,
            "verifier_passes": self.verifier_passes,
            "total_host_framing_tokens": self.total_host_framing_tokens,
            "token_steps": [step.to_dict() for step in self.token_steps],
            "attention": self.attention,
            "routing": self.routing,
            "visual_trace": self.visual_trace,
        }


def make_world_prompt(expression: str, facts: Mapping[str, int]) -> str:
    normalized = validate_bindings(facts)
    required = variables_in(expression)
    missing = [name for name in required if name not in normalized]
    if missing:
        raise KeyError(f"MISSING_PROMPT_FACTS: {','.join(missing)}")
    assignments = ",".join(f"{name}={normalized[name]}" for name in required)
    return f"WORLD({assignments});QUERY={expression}"


def make_query_prompt(expression: str) -> str:
    parse_expression(expression)
    return f"QUERY={expression}"


def prompt_prefix(
    prompt_text: str,
    objective: Objective,
    tokenizer: FixedTokenizer | None = None,
) -> list[int]:
    active = tokenizer or get_tokenizer()
    marker = FINAL_TOKEN if objective == "direct" else SCRATCH_TOKEN
    return [
        active.token_id(BOS_TOKEN),
        active.token_id(PROMPT_TOKEN),
        *active.encode(prompt_text),
        active.token_id(EOT_TOKEN),
        active.token_id(marker),
    ]


def _sample_token(
    logits: Tensor,
    *,
    policy: EffortPolicy,
    generator: torch.Generator,
    allowed_ids: Sequence[int] | None = None,
) -> tuple[int, float, tuple[tuple[int, float], ...]]:
    vector = logits.detach().float().cpu()
    if allowed_ids is not None:
        mask = torch.full_like(vector, float("-inf"))
        allowed_tensor = torch.tensor(tuple(allowed_ids), dtype=torch.long)
        mask[allowed_tensor] = vector[allowed_tensor]
        vector = mask
    if policy.temperature == 0.0:
        probabilities = torch.softmax(vector, dim=-1)
        chosen = int(torch.argmax(probabilities).item())
    else:
        scaled = vector / policy.temperature
        if 0 < policy.top_k < scaled.numel():
            threshold = torch.topk(scaled, policy.top_k).values[-1]
            scaled = scaled.masked_fill(scaled < threshold, float("-inf"))
        probabilities = torch.softmax(scaled, dim=-1)
        chosen = int(torch.multinomial(probabilities, 1, generator=generator).item())
    chosen_probability = max(float(probabilities[chosen].item()), 1e-12)
    top_values, top_indices = torch.topk(probabilities, min(5, probabilities.numel()))
    top = tuple(
        (int(token_id), float(probability))
        for token_id, probability in zip(top_indices.tolist(), top_values.tolist(), strict=True)
    )
    return chosen, math.log(chosen_probability), top


def _next_token(
    model: LanguageModel,
    context: list[int],
    *,
    tokenizer: FixedTokenizer,
    policy: EffortPolicy,
    generator: torch.Generator,
    allowed_ids: Sequence[int] | None = None,
) -> TokenStep:
    if len(context) >= model.config.context_length:
        raise OverflowError("CONTEXT_WINDOW_EXHAUSTED")
    input_ids = torch.tensor([context], dtype=torch.long)
    with torch.inference_mode():
        logits = model(input_ids).logits[0, -1]
    chosen, logprob, top = _sample_token(
        logits, policy=policy, generator=generator, allowed_ids=allowed_ids
    )
    return TokenStep(
        position=len(context),
        token_id=chosen,
        token_text=tokenizer.token_for_id(chosen),
        logprob=logprob,
        top_probabilities=tuple(
            (tokenizer.token_for_id(token_id), probability) for token_id, probability in top
        ),
    )


def _expression_signature(expression: Expr) -> tuple[tuple[str, str], ...]:
    signature: list[tuple[str, str]] = []

    def visit(node: Expr) -> None:
        if isinstance(node, Variable):
            signature.append(("GET", node.name))
            return
        visit(node.left)
        visit(node.right)
        signature.append(("OP", node.operator))

    visit(expression)
    return tuple(signature)


_SCRATCH_RE = re.compile(r"^TRACE\((.*)\);RESULT=([0-9])$")


def verify_generated_scratch(
    scratchpad: str,
    expression: str,
    facts: Mapping[str, int],
) -> tuple[bool, float, tuple[str, ...], int | None]:
    """Validate a generated public trace without consulting a stored gold label."""
    match = _SCRATCH_RE.fullmatch(scratchpad)
    if match is None:
        return False, 0.0, (), None
    trace_lines = tuple(part for part in match.group(1).split(";") if part)
    declared = int(match.group(2))
    expected_signature = _expression_signature(parse_expression(expression))
    if len(trace_lines) != len(expected_signature):
        return False, 0.1, trace_lines, declared
    normalized = validate_bindings(facts)
    stack: list[int] = []
    valid_steps = 0
    for line, signature in zip(trace_lines, expected_signature, strict=True):
        parts = line.split(" ")
        if signature[0] == "GET":
            if len(parts) != 3 or parts[0] != "GET" or parts[1] != signature[1]:
                break
            try:
                value = int(parts[2])
            except ValueError:
                break
            if normalized.get(parts[1]) != value:
                break
            stack.append(value)
        else:
            if len(parts) != 4 or parts[0] != signature[1] or len(stack) < 2:
                break
            try:
                left, right, result = (int(value) for value in parts[1:])
            except ValueError:
                break
            stack_right = stack.pop()
            stack_left = stack.pop()
            if (left, right) != (stack_left, stack_right):
                break
            computed = {
                "ADD": (left + right) % 10,
                "SUB": (left - right) % 10,
                "MUL": (left * right) % 10,
            }[parts[0]]
            if result != computed:
                break
            stack.append(result)
        valid_steps += 1
    score = valid_steps / max(1, len(expected_signature))
    valid = valid_steps == len(expected_signature) and stack == [declared]
    return valid, score if not valid else 1.0, trace_lines, declared


def _generate_direct(
    model: LanguageModel,
    prefix: list[int],
    *,
    tokenizer: FixedTokenizer,
    policy: EffortPolicy,
    generator: torch.Generator,
) -> Candidate:
    digit_ids = [tokenizer.token_id(str(value)) for value in range(10)]
    step = _next_token(
        model,
        prefix,
        tokenizer=tokenizer,
        policy=policy,
        generator=generator,
        allowed_ids=digit_ids,
    )
    answer = int(step.token_text)
    return Candidate(
        output_text=f"{FINAL_TOKEN}{answer}",
        final_answer=answer,
        scratchpad=None,
        trace_steps=(),
        normalized_logprob=step.logprob,
        protocol_valid=True,
        verifier_score=0.5,
        generated_tokens=1,
        forward_passes=1,
        token_steps=(step,),
        model_sequence=tuple([*prefix, step.token_id]),
        host_framing_tokens=len(prefix),
    )


def _scratch_structure(expression: str) -> tuple[str | None, ...]:
    """Return fixed DSL fragments with ``None`` at model-predicted digit slots."""
    nodes: list[Expr] = []

    def visit(node: Expr) -> None:
        if isinstance(node, BinaryOperation):
            visit(node.left)
            visit(node.right)
        nodes.append(node)

    visit(parse_expression(expression))
    structure: list[str | None] = ["TRACE("]
    for index, node in enumerate(nodes):
        if index:
            structure.append(";")
        if isinstance(node, Variable):
            structure.extend((f"GET {node.name} ", None))
        else:
            structure.extend((f"{node.operator} ", None, " ", None, " ", None))
    structure.extend((");RESULT=", None))
    return tuple(structure)


def _generate_scratch(
    model: LanguageModel,
    prefix: list[int],
    *,
    tokenizer: FixedTokenizer,
    policy: EffortPolicy,
    generator: torch.Generator,
    expression: str,
    facts: Mapping[str, int],
) -> Candidate:
    context = list(prefix)
    scratch_ids: list[int] = []
    token_steps: list[TokenStep] = []
    incomplete = False
    host_framing_tokens = len(prefix)
    digit_ids = [tokenizer.token_id(str(value)) for value in range(10)]
    predicted_slots = 0
    for fragment in _scratch_structure(expression):
        if fragment is not None:
            fixed_ids = list(tokenizer.encode(fragment))
            if len(context) + len(fixed_ids) >= model.config.context_length:
                incomplete = True
                break
            context.extend(fixed_ids)
            scratch_ids.extend(fixed_ids)
            host_framing_tokens += len(fixed_ids)
            continue
        if predicted_slots >= policy.max_scratch_tokens:
            incomplete = True
            break
        try:
            step = _next_token(
                model,
                context,
                tokenizer=tokenizer,
                policy=policy,
                generator=generator,
                allowed_ids=digit_ids,
            )
        except OverflowError:
            incomplete = True
            break
        context.append(step.token_id)
        scratch_ids.append(step.token_id)
        token_steps.append(step)
        predicted_slots += 1

    scratchpad = tokenizer.decode(scratch_ids)
    valid, score, trace_steps, scratch_answer = verify_generated_scratch(
        scratchpad, expression, facts
    )
    # Segment markers are host-owned protocol framing.  The digit after FINAL
    # remains a model prediction, matching the training loss mask.
    final_framing = (tokenizer.token_id(EOT_TOKEN), tokenizer.token_id(FINAL_TOKEN))
    context.extend(final_framing)
    host_framing_tokens += len(final_framing)
    final_step: TokenStep | None = None
    try:
        final_step = _next_token(
            model,
            context,
            tokenizer=tokenizer,
            policy=policy,
            generator=generator,
            allowed_ids=[tokenizer.token_id(str(value)) for value in range(10)],
        )
        token_steps.append(final_step)
        final_answer = int(final_step.token_text)
    except OverflowError:
        final_answer = None
        incomplete = True
    protocol_valid = valid and final_answer is not None and scratch_answer == final_answer
    if valid and scratch_answer == final_answer:
        score = 1.0
    elif valid:
        score = 0.85
    logprob = sum(step.logprob for step in token_steps) / max(1, len(token_steps))
    output = f"{SCRATCH_TOKEN}{scratchpad}{EOT_TOKEN}{FINAL_TOKEN}{final_answer if final_answer is not None else ''}"
    return Candidate(
        output_text=output,
        final_answer=final_answer,
        scratchpad=scratchpad,
        trace_steps=trace_steps,
        normalized_logprob=logprob,
        protocol_valid=protocol_valid,
        verifier_score=score,
        generated_tokens=len(token_steps),
        forward_passes=len(token_steps),
        token_steps=tuple(token_steps),
        model_sequence=tuple(
            [
                *prefix,
                *scratch_ids,
                tokenizer.token_id(EOT_TOKEN),
                tokenizer.token_id(FINAL_TOKEN),
                *([] if final_step is None else [final_step.token_id]),
            ]
        ),
        host_framing_tokens=host_framing_tokens,
        incomplete_budget=incomplete,
    )


def _select_candidate(candidates: Sequence[Candidate]) -> int:
    answers = Counter(
        candidate.final_answer for candidate in candidates if candidate.final_answer is not None
    )
    majority = answers.most_common(1)[0][0] if answers else None
    return max(
        range(len(candidates)),
        key=lambda index: (
            candidates[index].protocol_valid,
            candidates[index].verifier_score,
            candidates[index].final_answer == majority,
            candidates[index].normalized_logprob,
            -index,
        ),
    )


def _capture_visual_trace(
    model: LanguageModel,
    token_ids: Sequence[int],
    *,
    tokenizer: FixedTokenizer,
) -> tuple[list[list[float]] | None, list[dict[str, Any]], dict[str, Any]]:
    clipped = list(token_ids)[-model.config.context_length :]
    sequence_start_position = len(token_ids) - len(clipped)
    with torch.inference_mode():
        output = model(torch.tensor([clipped], dtype=torch.long), capture=True)
    trace = output.trace or {}
    layers = trace.get("layers", [])
    attention: list[list[float]] | None = None
    routing: list[dict[str, Any]] = []
    routing_assignments: list[dict[str, Any]] = []
    attention_metadata: dict[str, Any] | None = None
    if layers:
        weights = layers[-1]["attention"]["weights"][0].mean(dim=0)
        attention = weights.detach().float().cpu().tolist()
        attention_metadata = {
            "layer_index": len(layers) - 1,
            "head_reduction": "mean",
            "matrix": attention,
        }
        for layer_index, layer in enumerate(layers):
            moe = layer.get("moe")
            if moe is None:
                continue
            counts = moe["expert_counts"].detach().cpu().tolist()
            importance = moe["router_importance"].detach().float().cpu().tolist()
            for expert_index, (count, probability) in enumerate(
                zip(counts, importance, strict=True)
            ):
                routing.append(
                    {
                        "layer_index": layer_index,
                        "expert_index": expert_index,
                        "token_count": int(count),
                        "mean_gate_probability": float(probability),
                    }
                )
            selected_experts = moe["selected_experts"][0].detach().cpu().tolist()
            router_probabilities = moe["router_probabilities"][0].detach().float().cpu()
            if len(selected_experts) != len(clipped):
                raise RuntimeError("MOE_ROUTING_TRACE_LENGTH_MISMATCH")
            for relative_position, expert_index in enumerate(selected_experts):
                token_id = clipped[relative_position]
                routing_assignments.append(
                    {
                        "layer_index": layer_index,
                        "position": sequence_start_position + relative_position,
                        "relative_position": relative_position,
                        "token_id": token_id,
                        "token_text": tokenizer.token_for_id(token_id),
                        "expert_index": int(expert_index),
                        "gate_probability": float(
                            router_probabilities[relative_position, expert_index].item()
                        ),
                    }
                )
    visual_trace = {
        "captured": True,
        "scope": "selected_candidate_final_snapshot",
        "architecture": str(trace.get("architecture", model.model_kind)),
        "sequence_start_position": sequence_start_position,
        "tokens": [
            {
                "position": sequence_start_position + relative_position,
                "relative_position": relative_position,
                "token_id": token_id,
                "token_text": tokenizer.token_for_id(token_id),
            }
            for relative_position, token_id in enumerate(clipped)
        ],
        "attention": attention_metadata,
        "routing_assignments": routing_assignments,
    }
    return attention, routing, visual_trace


def generate(
    model: LanguageModel,
    *,
    prompt_text: str,
    expression: str,
    facts: Mapping[str, int],
    objective: Objective,
    effort: Effort = "low",
    seed: int = 0,
    capture: bool = True,
    tokenizer: FixedTokenizer | None = None,
) -> InferenceResult:
    active = tokenizer or get_tokenizer()
    policy = EFFORT_POLICIES[effort]
    model.eval()
    started = perf_counter()
    candidates: list[Candidate] = []
    prefix = prompt_prefix(prompt_text, objective, active)
    for index in range(policy.candidates):
        generator = torch.Generator(device="cpu").manual_seed(seed + index * 104_729)
        if objective == "direct":
            candidate = _generate_direct(
                model,
                prefix,
                tokenizer=active,
                policy=policy,
                generator=generator,
            )
        else:
            candidate = _generate_scratch(
                model,
                prefix,
                tokenizer=active,
                policy=policy,
                generator=generator,
                expression=expression,
                facts=facts,
            )
        candidates.append(candidate)
    selected_index = _select_candidate(candidates)
    selected = candidates[selected_index]
    selected.selected = True
    attention: list[list[float]] | None = None
    routing: list[dict[str, Any]] = []
    visual_trace: dict[str, Any] | None = None
    if capture:
        attention, routing, visual_trace = _capture_visual_trace(
            model,
            selected.model_sequence,
            tokenizer=active,
        )
    elapsed_ms = (perf_counter() - started) * 1000.0
    return InferenceResult(
        answer=selected.final_answer,
        output_text=selected.output_text,
        scratchpad=selected.scratchpad,
        trace_steps=selected.trace_steps,
        protocol_valid=selected.protocol_valid,
        effort=effort,
        candidates=tuple(candidates),
        selected_index=selected_index,
        elapsed_ms=elapsed_ms,
        total_generated_tokens=sum(candidate.generated_tokens for candidate in candidates),
        total_forward_passes=sum(candidate.forward_passes for candidate in candidates)
        + int(capture),
        verifier_passes=policy.verifier_passes * len(candidates),
        total_host_framing_tokens=sum(candidate.host_framing_tokens for candidate in candidates),
        token_steps=selected.token_steps,
        attention=attention,
        routing=routing,
        visual_trace=visual_trace,
    )


__all__ = [
    "EFFORT_POLICIES",
    "Candidate",
    "Effort",
    "EffortPolicy",
    "InferenceResult",
    "TokenStep",
    "generate",
    "make_query_prompt",
    "make_world_prompt",
    "prompt_prefix",
    "verify_generated_scratch",
]
