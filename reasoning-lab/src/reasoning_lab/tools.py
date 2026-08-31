"""Strict, host-executed tools available to the miniature model agent."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from time import perf_counter
from typing import Any, Literal

ToolStatus = Literal["ok", "rejected", "error", "budget_exhausted"]
ALLOWED_OPERATIONS = frozenset({"ADD", "SUB", "MUL"})
ALLOWED_VARIABLES = frozenset("ABCDEFGH")


@dataclass(frozen=True)
class ToolRequest:
    name: str
    arguments: Mapping[str, Any]


@dataclass(frozen=True)
class ToolResult:
    request: ToolRequest
    status: ToolStatus
    value: int | None
    error: str | None
    elapsed_ms: float


def parse_tool_call(text: str) -> ToolRequest:
    """Parse the tiny call grammar; there is deliberately no JSON/eval escape."""
    stripped = text.strip()
    if stripped.startswith("<CALL>"):
        stripped = stripped[len("<CALL>") :].strip()
    if stripped.endswith("<EOT>"):
        stripped = stripped[: -len("<EOT>")].strip()
    parts = stripped.split()
    if len(parts) == 2 and parts[0] == "LOOKUP":
        return ToolRequest("LOOKUP", {"variable": parts[1]})
    if len(parts) == 4 and parts[0] == "CALC":
        try:
            left, right = int(parts[2]), int(parts[3])
        except ValueError as exc:
            raise ValueError("CALC operands must be decimal integers") from exc
        return ToolRequest("CALC", {"operation": parts[1], "left": left, "right": right})
    raise ValueError("Expected LOOKUP <A-H> or CALC <ADD|SUB|MUL> <0-9> <0-9>")


class ToolRuntime:
    """A deterministic capability boundary owned by the host, not the model."""

    def __init__(self, facts: Mapping[str, int], *, max_calls: int = 16) -> None:
        self._facts = {str(key): int(value) for key, value in facts.items()}
        self.max_calls = max_calls
        self.calls_used = 0
        self.history: list[ToolResult] = []

    def execute(self, request: ToolRequest) -> ToolResult:
        started = perf_counter()
        if self.calls_used >= self.max_calls:
            return self._record(
                request, "budget_exhausted", None, "Tool-call budget exhausted", started
            )
        self.calls_used += 1
        try:
            if request.name == "LOOKUP":
                value = self._lookup(request.arguments)
            elif request.name == "CALC":
                value = self._calc(request.arguments)
            else:
                return self._record(request, "rejected", None, "Tool is not allow-listed", started)
        except (KeyError, TypeError, ValueError) as exc:
            return self._record(request, "rejected", None, str(exc), started)
        return self._record(request, "ok", value, None, started)

    def _lookup(self, arguments: Mapping[str, Any]) -> int:
        if set(arguments) != {"variable"}:
            raise ValueError("LOOKUP accepts exactly one variable argument")
        variable = arguments["variable"]
        if not isinstance(variable, str) or variable not in ALLOWED_VARIABLES:
            raise ValueError("LOOKUP variable must be one of A..H")
        if variable not in self._facts:
            raise KeyError(f"Variable {variable} is absent from this world")
        value = self._facts[variable]
        if not 0 <= value <= 9:
            raise ValueError("Stored fact is outside 0..9")
        return value

    @staticmethod
    def _calc(arguments: Mapping[str, Any]) -> int:
        if set(arguments) != {"operation", "left", "right"}:
            raise ValueError("CALC accepts operation, left, and right")
        operation = arguments["operation"]
        left = arguments["left"]
        right = arguments["right"]
        if operation not in ALLOWED_OPERATIONS:
            raise ValueError("CALC operation must be ADD, SUB, or MUL")
        if type(left) is not int or type(right) is not int:  # bool is not accepted
            raise TypeError("CALC operands must be integers")
        if not (0 <= left <= 9 and 0 <= right <= 9):
            raise ValueError("CALC operands must be inside 0..9")
        if operation == "ADD":
            return (left + right) % 10
        if operation == "SUB":
            return (left - right) % 10
        return (left * right) % 10

    def _record(
        self,
        request: ToolRequest,
        status: ToolStatus,
        value: int | None,
        error: str | None,
        started: float,
    ) -> ToolResult:
        result = ToolResult(
            request=request,
            status=status,
            value=value,
            error=error,
            elapsed_ms=(perf_counter() - started) * 1000.0,
        )
        self.history.append(result)
        return result
