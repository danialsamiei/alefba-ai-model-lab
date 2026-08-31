"""A transparent scripted controller that demonstrates host-side tool execution.

This controller is intentionally not presented as learned tool selection.  It
walks the public DSL tree, emits typed calls, and lets :class:`ToolRuntime`
execute them.  A future learned policy can be compared against this exact
ceiling without changing the executor or its security boundary.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from time import perf_counter
from typing import Any

from reasoning_lab.task import BinaryOperation, Expr, Variable, parse_expression
from reasoning_lab.tools import ToolRequest, ToolResult, ToolRuntime


@dataclass(frozen=True, slots=True)
class ToolCallEvent:
    index: int
    name: str
    arguments: dict[str, Any]
    result: int | None
    status: str
    error: str | None
    elapsed_ms: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "index": self.index,
            "name": self.name,
            "arguments": self.arguments,
            "result": self.result,
            "status": self.status,
            "error": self.error,
            "elapsed_ms": self.elapsed_ms,
        }


@dataclass(frozen=True, slots=True)
class ToolAgentResult:
    answer: int | None
    status: str
    calls: tuple[ToolCallEvent, ...]
    transcript: tuple[str, ...]
    elapsed_ms: float
    controller: str = "scripted_ast_controller"
    learned_policy: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "answer": self.answer,
            "status": self.status,
            "tool_calls": [call.to_dict() for call in self.calls],
            "trace_steps": list(self.transcript),
            "elapsed_ms": self.elapsed_ms,
            "controller": self.controller,
            "learned_policy": self.learned_policy,
        }


def run_scripted_tool_agent(
    expression: str,
    facts: Mapping[str, int],
    *,
    max_calls: int = 16,
) -> ToolAgentResult:
    started = perf_counter()
    runtime = ToolRuntime(facts, max_calls=max_calls)
    events: list[ToolCallEvent] = []
    transcript: list[str] = []

    def execute(request: ToolRequest) -> ToolResult:
        result = runtime.execute(request)
        index = len(events)
        events.append(
            ToolCallEvent(
                index=index,
                name=request.name,
                arguments=dict(request.arguments),
                result=result.value,
                status=result.status,
                error=result.error,
                elapsed_ms=result.elapsed_ms,
            )
        )
        rendered_args = " ".join(str(value) for value in request.arguments.values())
        transcript.append(f"CALL {request.name} {rendered_args}".rstrip())
        transcript.append(
            f"OBS {result.value}" if result.status == "ok" else f"OBS {result.status}"
        )
        if result.status != "ok" or result.value is None:
            raise RuntimeError(result.error or result.status)
        return result

    def visit(node: Expr) -> int:
        if isinstance(node, Variable):
            result = execute(ToolRequest("LOOKUP", {"variable": node.name}))
            assert result.value is not None
            return result.value
        assert isinstance(node, BinaryOperation)
        left = visit(node.left)
        right = visit(node.right)
        result = execute(
            ToolRequest(
                "CALC",
                {"operation": node.operator, "left": left, "right": right},
            )
        )
        assert result.value is not None
        return result.value

    answer: int | None = None
    status = "ok"
    try:
        answer = visit(parse_expression(expression))
        transcript.append(f"FINAL {answer}")
    except RuntimeError:
        status = "incomplete_budget" if runtime.calls_used >= max_calls else "error"
        transcript.append(
            "FINAL INCOMPLETE_BUDGET" if status == "incomplete_budget" else "FINAL ERROR"
        )
    return ToolAgentResult(
        answer=answer,
        status=status,
        calls=tuple(events),
        transcript=tuple(transcript),
        elapsed_ms=(perf_counter() - started) * 1000.0,
    )


__all__ = ["ToolAgentResult", "ToolCallEvent", "run_scripted_tool_agent"]
