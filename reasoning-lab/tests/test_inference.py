from __future__ import annotations

from dataclasses import replace
from typing import Any

import pytest
import torch

from reasoning_lab.config import load_project_config
from reasoning_lab.inference import (
    EFFORT_POLICIES,
    generate,
    make_world_prompt,
    prompt_prefix,
    verify_generated_scratch,
)
from reasoning_lab.models import LanguageModel, LMOutput, build_model
from reasoning_lab.tokenizer import get_tokenizer


class ConstantDigitModel(LanguageModel):
    model_kind = "constant_test"

    def forward(
        self,
        input_ids: torch.Tensor,
        targets: torch.Tensor | None = None,
        loss_mask: torch.Tensor | None = None,
        capture: bool = False,
    ) -> LMOutput:
        batch, time = self._validate_input_ids(input_ids)
        logits = torch.full((batch, time, self.vocab_size), -20.0)
        logits[:, :, get_tokenizer().token_id("6")] = 20.0
        trace: dict[str, Any] | None = {"layers": []} if capture else None
        return LMOutput(logits, None, logits.new_zeros(()), trace)


def test_verifier_checks_public_trace_not_stored_gold() -> None:
    facts = {"A": 3, "B": 5, "C": 2}
    scratch = "TRACE(GET A 3;GET B 5;ADD 3 5 8;GET C 2;MUL 8 2 6);RESULT=6"
    valid, score, steps, answer = verify_generated_scratch(scratch, "MUL(ADD(A,B),C)", facts)
    assert valid and score == 1.0 and answer == 6 and len(steps) == 5
    assert not verify_generated_scratch(scratch.replace(" 8", " 7", 1), "MUL(ADD(A,B),C)", facts)[0]


def test_effort_changes_budget_not_checkpoint() -> None:
    config = replace(load_project_config().model, context_length=96)
    model = ConstantDigitModel(config, get_tokenizer().vocab_size)
    prompt = make_world_prompt("ADD(A,B)", {"A": 1, "B": 5})
    low = generate(
        model,
        prompt_text=prompt,
        expression="ADD(A,B)",
        facts={"A": 1, "B": 5},
        objective="direct",
        effort="low",
        seed=4,
        capture=False,
    )
    high = generate(
        model,
        prompt_text=prompt,
        expression="ADD(A,B)",
        facts={"A": 1, "B": 5},
        objective="direct",
        effort="high",
        seed=4,
        capture=False,
    )
    assert low.answer == high.answer == 6
    assert len(low.candidates) == EFFORT_POLICIES["low"].candidates
    assert len(high.candidates) == EFFORT_POLICIES["high"].candidates
    assert high.total_forward_passes > low.total_forward_passes


def test_prompt_prefix_is_objective_specific() -> None:
    tokenizer = get_tokenizer()
    prompt = make_world_prompt("A", {"A": 3})
    direct = prompt_prefix(prompt, "direct", tokenizer)
    scratch = prompt_prefix(prompt, "scratch", tokenizer)
    assert direct[:-1] == scratch[:-1]
    assert tokenizer.token_for_id(direct[-1]) == "<FINAL>"
    assert tokenizer.token_for_id(scratch[-1]) == "<SCRATCH>"


def test_moe_visual_trace_has_bounded_token_level_routing_assignments() -> None:
    torch.manual_seed(12)
    tokenizer = get_tokenizer()
    config = replace(load_project_config().model, context_length=32)
    model = build_model("moe_transformer", config, tokenizer.vocab_size)
    result = generate(
        model,
        prompt_text=make_world_prompt("A", {"A": 3}),
        expression="A",
        facts={"A": 3},
        objective="direct",
        effort="low",
        seed=4,
        capture=True,
    )
    assert result.visual_trace is not None
    visual_tokens = result.visual_trace["tokens"]
    assignments = result.visual_trace["routing_assignments"]
    assert len(visual_tokens) <= config.context_length
    assert len(assignments) == len(visual_tokens) * config.n_layers
    assert len(result.routing) == config.n_layers * config.n_experts
    for assignment in assignments:
        assert 0 <= assignment["expert_index"] < config.n_experts
        assert 0.0 <= assignment["gate_probability"] <= 1.0
        token = visual_tokens[assignment["relative_position"]]
        assert assignment["token_id"] == token["token_id"]
        assert assignment["token_text"] == token["token_text"]


def test_invalid_effort_fails_closed() -> None:
    config = load_project_config().model
    model = ConstantDigitModel(config, get_tokenizer().vocab_size)
    with pytest.raises(KeyError):
        generate(
            model,
            prompt_text=make_world_prompt("A", {"A": 3}),
            expression="A",
            facts={"A": 3},
            objective="direct",
            effort="unbounded",  # type: ignore[arg-type]
        )
