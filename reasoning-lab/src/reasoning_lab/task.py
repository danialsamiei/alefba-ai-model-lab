from __future__ import annotations

import random
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from typing import Final, Literal, Never, TypeAlias, cast

MODULUS: Final = 10
VARIABLES: Final[tuple[str, ...]] = tuple("ABCDEFGH")
OPERATORS: Final[tuple[str, ...]] = ("ADD", "SUB", "MUL")
Operator: TypeAlias = Literal["ADD", "SUB", "MUL"]


class ExpressionSyntaxError(ValueError):
    """A source-positioned error raised by the closed DSL parser."""


@dataclass(frozen=True, slots=True)
class Variable:
    name: str

    def __post_init__(self) -> None:
        if self.name not in VARIABLES:
            raise ValueError(f"INVALID_VARIABLE: {self.name!r}")

    @property
    def depth(self) -> int:
        return 0

    def render(self) -> str:
        return self.name


@dataclass(frozen=True, slots=True)
class BinaryOperation:
    operator: Operator
    left: Expr
    right: Expr

    def __post_init__(self) -> None:
        if self.operator not in OPERATORS:
            raise ValueError(f"INVALID_OPERATOR: {self.operator!r}")
        if not isinstance(self.left, (Variable, BinaryOperation)):
            raise TypeError("LEFT_OPERAND_MUST_BE_AN_EXPRESSION")
        if not isinstance(self.right, (Variable, BinaryOperation)):
            raise TypeError("RIGHT_OPERAND_MUST_BE_AN_EXPRESSION")

    @property
    def depth(self) -> int:
        return 1 + max(self.left.depth, self.right.depth)

    def render(self) -> str:
        return f"{self.operator}({self.left.render()},{self.right.render()})"


Expr: TypeAlias = Variable | BinaryOperation
# Readable aliases for consumers that prefer grammar terminology.
Var = Variable
Operation = BinaryOperation
BinaryExpr = BinaryOperation


class _Parser:
    def __init__(self, source: str, *, max_depth: int) -> None:
        self.source = source
        self.position = 0
        self.max_depth = max_depth

    def _skip_whitespace(self) -> None:
        while self.position < len(self.source) and self.source[self.position].isspace():
            self.position += 1

    def _fail(self, expected: str) -> Never:
        excerpt = self.source[self.position : self.position + 16]
        raise ExpressionSyntaxError(f"EXPECTED_{expected}_AT_{self.position}: {excerpt!r}")

    def _consume(self, literal: str) -> None:
        self._skip_whitespace()
        if not self.source.startswith(literal, self.position):
            self._fail(repr(literal))
        self.position += len(literal)

    def parse_node(self, nesting: int = 0) -> Expr:
        self._skip_whitespace()
        if nesting > self.max_depth:
            raise ExpressionSyntaxError(
                f"EXPRESSION_NESTING_EXCEEDS_{self.max_depth}_AT_{self.position}"
            )
        if self.position >= len(self.source):
            self._fail("EXPRESSION")

        operator = next(
            (
                candidate
                for candidate in OPERATORS
                if self.source.startswith(candidate, self.position)
            ),
            None,
        )
        if operator is not None:
            self.position += len(operator)
            self._consume("(")
            left = self.parse_node(nesting + 1)
            self._consume(",")
            right = self.parse_node(nesting + 1)
            self._consume(")")
            return BinaryOperation(cast(Operator, operator), left, right)

        current = self.source[self.position]
        if current in VARIABLES:
            self.position += 1
            return Variable(current)
        self._fail("VARIABLE_OR_OPERATOR")

    def finish(self) -> None:
        self._skip_whitespace()
        if self.position != len(self.source):
            self._fail("END_OF_EXPRESSION")


def parse_expression(source: str, *, max_depth: int = 64) -> Expr:
    """Parse the complete DSL input, allowing only insignificant whitespace."""

    if not isinstance(source, str):
        raise TypeError("EXPRESSION_SOURCE_MUST_BE_TEXT")
    if max_depth < 0:
        raise ValueError("MAX_PARSE_DEPTH_MUST_BE_NON_NEGATIVE")
    parser = _Parser(source, max_depth=max_depth)
    expression = parser.parse_node()
    parser.finish()
    return expression


def render_expression(expression: Expr) -> str:
    if not isinstance(expression, (Variable, BinaryOperation)):
        raise TypeError("VALUE_MUST_BE_AN_EXPRESSION")
    return expression.render()


def expression_depth(expression: Expr | str) -> int:
    parsed = parse_expression(expression) if isinstance(expression, str) else expression
    return parsed.depth


def variables_in(expression: Expr | str) -> tuple[str, ...]:
    """Return referenced variables once, in canonical A..H order."""

    parsed = parse_expression(expression) if isinstance(expression, str) else expression
    found: set[str] = set()

    def visit(node: Expr) -> None:
        if isinstance(node, Variable):
            found.add(node.name)
            return
        visit(node.left)
        visit(node.right)

    visit(parsed)
    return tuple(variable for variable in VARIABLES if variable in found)


def validate_bindings(bindings: Mapping[str, int]) -> dict[str, int]:
    """Validate and copy a modulo-10 world without silently normalizing it."""

    if not isinstance(bindings, Mapping):
        raise TypeError("BINDINGS_MUST_BE_A_MAPPING")
    normalized: dict[str, int] = {}
    for name, value in bindings.items():
        if name not in VARIABLES:
            raise ValueError(f"INVALID_BINDING_VARIABLE: {name!r}")
        if isinstance(value, bool) or not isinstance(value, int):
            raise TypeError(f"BINDING_VALUE_MUST_BE_AN_INTEGER: {name}")
        if not 0 <= value < MODULUS:
            raise ValueError(f"BINDING_VALUE_OUTSIDE_ZERO_TO_NINE: {name}={value}")
        normalized[name] = value
    return normalized


def _apply(operator: Operator, left: int, right: int) -> int:
    if operator == "ADD":
        raw = left + right
    elif operator == "SUB":
        raw = left - right
    elif operator == "MUL":
        raw = left * right
    else:  # pragma: no cover - protected by the AST dataclass
        raise AssertionError(f"UNHANDLED_OPERATOR: {operator}")
    return raw % MODULUS


@dataclass(frozen=True, slots=True)
class TraceStep:
    index: int
    expression: str
    operation: Literal["GET", "ADD", "SUB", "MUL"]
    operands: tuple[int, ...]
    value: int
    depth: int

    def __post_init__(self) -> None:
        if self.index < 0:
            raise ValueError("TRACE_INDEX_MUST_BE_NON_NEGATIVE")
        if self.operation == "GET" and self.operands:
            raise ValueError("VARIABLE_TRACE_STEP_MUST_NOT_HAVE_OPERANDS")
        if self.operation != "GET" and len(self.operands) != 2:
            raise ValueError("OPERATOR_TRACE_STEP_REQUIRES_TWO_OPERANDS")
        if not 0 <= self.value < MODULUS:
            raise ValueError("TRACE_VALUE_OUTSIDE_MODULUS")

    def render(self) -> str:
        if self.operation == "GET":
            return f"GET {self.expression} {self.value}"
        left, right = self.operands
        return f"{self.operation} {left} {right} {self.value}"

    def to_dict(self) -> dict[str, object]:
        return {
            "index": self.index,
            "expression": self.expression,
            "operation": self.operation,
            "operands": list(self.operands),
            "value": self.value,
            "depth": self.depth,
        }


@dataclass(frozen=True, slots=True)
class EvaluationResult:
    value: int
    trace: tuple[TraceStep, ...]

    @property
    def trace_text(self) -> str:
        return render_trace(self.trace)


def evaluate_with_trace(
    expression: Expr | str,
    bindings: Mapping[str, int],
) -> EvaluationResult:
    """Evaluate modulo ten and emit a canonical left-to-right postorder trace."""

    parsed = parse_expression(expression) if isinstance(expression, str) else expression
    values = validate_bindings(bindings)
    steps: list[TraceStep] = []

    def visit(node: Expr) -> int:
        if isinstance(node, Variable):
            try:
                value = values[node.name]
            except KeyError as error:
                raise KeyError(f"MISSING_BINDING: {node.name}") from error
            steps.append(
                TraceStep(
                    index=len(steps),
                    expression=node.render(),
                    operation="GET",
                    operands=(),
                    value=value,
                    depth=0,
                )
            )
            return value
        left = visit(node.left)
        right = visit(node.right)
        value = _apply(node.operator, left, right)
        steps.append(
            TraceStep(
                index=len(steps),
                expression=node.render(),
                operation=node.operator,
                operands=(left, right),
                value=value,
                depth=node.depth,
            )
        )
        return value

    result = visit(parsed)
    return EvaluationResult(value=result, trace=tuple(steps))


def evaluate_expression(expression: Expr | str, bindings: Mapping[str, int]) -> int:
    return evaluate_with_trace(expression, bindings).value


def render_trace(trace: Iterable[TraceStep]) -> str:
    return ";".join(step.render() for step in trace)


def canonical_trace(expression: Expr | str, bindings: Mapping[str, int]) -> tuple[str, ...]:
    return tuple(step.render() for step in evaluate_with_trace(expression, bindings).trace)


def canonical_trace_text(expression: Expr | str, bindings: Mapping[str, int]) -> str:
    return render_trace(evaluate_with_trace(expression, bindings).trace)


def generate_expression(
    rng: random.Random,
    depth: int,
    *,
    variables: Sequence[str] = VARIABLES,
) -> Expr:
    """Generate an expression of exactly ``depth`` with bounded linear growth.

    One child carries the required depth and the other is a variable.  This
    preserves a clean depth curriculum while keeping depth-OOD transcripts well
    inside the laboratory's intentionally small context window.
    """

    if isinstance(depth, bool) or not isinstance(depth, int):
        raise TypeError("EXPRESSION_DEPTH_MUST_BE_AN_INTEGER")
    if depth < 0:
        raise ValueError("EXPRESSION_DEPTH_MUST_BE_NON_NEGATIVE")
    choices = tuple(variables)
    if not choices:
        raise ValueError("EXPRESSION_VARIABLE_SET_MUST_NOT_BE_EMPTY")
    if any(variable not in VARIABLES for variable in choices):
        raise ValueError("EXPRESSION_VARIABLE_SET_CONTAINS_INVALID_NAME")

    if depth == 0:
        return Variable(rng.choice(choices))
    deep_child = generate_expression(rng, depth - 1, variables=choices)
    leaf = Variable(rng.choice(choices))
    operator = cast(Operator, rng.choice(OPERATORS))
    if rng.randrange(2) == 0:
        return BinaryOperation(operator, deep_child, leaf)
    return BinaryOperation(operator, leaf, deep_child)


# Concise aliases keep the module pleasant in notebooks without creating a
# second implementation path.
parse = parse_expression
render = render_expression
evaluate = evaluate_expression
evaluate_mod10 = evaluate_expression


__all__ = [
    "MODULUS",
    "OPERATORS",
    "VARIABLES",
    "BinaryExpr",
    "BinaryOperation",
    "EvaluationResult",
    "Expr",
    "ExpressionSyntaxError",
    "Operation",
    "Operator",
    "TraceStep",
    "Var",
    "Variable",
    "canonical_trace",
    "canonical_trace_text",
    "evaluate",
    "evaluate_expression",
    "evaluate_mod10",
    "evaluate_with_trace",
    "expression_depth",
    "generate_expression",
    "parse",
    "parse_expression",
    "render",
    "render_expression",
    "render_trace",
    "validate_bindings",
    "variables_in",
]
