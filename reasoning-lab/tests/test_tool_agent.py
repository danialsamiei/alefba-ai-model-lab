from reasoning_lab.tool_agent import run_scripted_tool_agent


def test_scripted_tool_agent_is_exact_and_auditable() -> None:
    result = run_scripted_tool_agent("MUL(ADD(A,B),C)", {"A": 3, "B": 5, "C": 2}, max_calls=8)
    assert result.answer == 6
    assert result.status == "ok"
    assert result.learned_policy is False
    assert [call.name for call in result.calls] == [
        "LOOKUP",
        "LOOKUP",
        "CALC",
        "LOOKUP",
        "CALC",
    ]
    assert result.transcript[-1] == "FINAL 6"


def test_scripted_tool_agent_fails_closed_on_budget() -> None:
    result = run_scripted_tool_agent("ADD(A,B)", {"A": 1, "B": 2}, max_calls=2)
    assert result.answer is None
    assert result.status == "incomplete_budget"
    assert result.calls[-1].status == "budget_exhausted"
