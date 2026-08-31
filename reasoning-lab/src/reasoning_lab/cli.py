"""Command-line entry point for every reproducible laboratory stage."""

from __future__ import annotations

import argparse
import json
from typing import Any

from reasoning_lab.acceptance import verify_acceptance
from reasoning_lab.lab import (
    ALL_PROFILES,
    Laboratory,
    build_data,
    evaluate_profiles,
    train_all,
    train_profile,
)


def _print(value: Any) -> None:
    print(json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2))


def _training_summary(result: dict[str, Any]) -> dict[str, Any]:
    telemetry = result.get("telemetry", {})
    if "steps" not in telemetry:
        return result
    steps = telemetry.get("steps", [])
    validations = telemetry.get("validations", [])
    return {key: value for key, value in result.items() if key != "telemetry"} | {
        "telemetry_summary": {
            "steps": len(steps),
            "train_examples": telemetry.get("train_example_count"),
            "validation_examples": telemetry.get("validation_example_count"),
            "training_data_sha256": telemetry.get("training_data_sha256"),
            "final_validation": validations[-1] if validations else None,
        }
    }


def _facts(value: str) -> dict[str, int]:
    facts: dict[str, int] = {}
    if not value:
        return facts
    for assignment in value.split(","):
        try:
            name, raw = assignment.split("=", 1)
            number = int(raw)
        except ValueError as error:
            raise argparse.ArgumentTypeError("Use A=3,B=5 syntax") from error
        if name not in tuple("ABCDEFGH") or not 0 <= number <= 9:
            raise argparse.ArgumentTypeError("Facts require A..H keys and 0..9 values")
        facts[name] = number
    return facts


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(
        prog="reasoning-lab",
        description="Transparent micro lab for model architectures and inference systems",
    )
    commands = root.add_subparsers(dest="command", required=True)
    commands.add_parser("build-data", help="Generate, hash, and persist the curriculum")

    train = commands.add_parser("train", help="Train one profile")
    train.add_argument("profile", choices=ALL_PROFILES)
    commands.add_parser("train-all", help="Train n-gram and all neural profiles")

    evaluate = commands.add_parser("evaluate", help="Run held-out evaluation")
    evaluate.add_argument("--limit", type=int, default=None)

    solve = commands.add_parser("solve", help="Run one inspectable experiment")
    solve.add_argument("expression")
    solve.add_argument("--facts", type=_facts, default={"A": 3, "B": 5, "C": 2})
    solve.add_argument("--model", choices=ALL_PROFILES, default="dense_scratch")
    solve.add_argument(
        "--mode", choices=("model_only", "rag", "tools", "oracle"), default="model_only"
    )
    solve.add_argument("--effort", choices=("low", "medium", "high"), default="low")
    solve.add_argument("--no-capture", action="store_true")

    serve = commands.add_parser("serve", help="Start the local API and visual laboratory")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8000)

    commands.add_parser("status", help="Inspect database and checkpoint readiness")
    commands.add_parser("verify", help="Run artifact, boundary, and provenance acceptance gates")
    return root


def main(argv: list[str] | None = None) -> None:
    arguments = parser().parse_args(argv)
    if arguments.command == "build-data":
        _print(build_data())
    elif arguments.command == "train":
        _print(_training_summary(train_profile(arguments.profile)))
    elif arguments.command == "train-all":
        _print([_training_summary(result) for result in train_all()])
    elif arguments.command == "evaluate":
        if arguments.limit is not None and arguments.limit <= 0:
            raise SystemExit("--limit must be positive")
        _print(evaluate_profiles(limit_per_split=arguments.limit))
    elif arguments.command == "solve":
        _print(
            Laboratory().solve(
                model=arguments.model,
                mode=arguments.mode,
                effort=arguments.effort,
                expression=arguments.expression,
                facts=arguments.facts,
                capture=not arguments.no_capture,
            )
        )
    elif arguments.command == "status":
        _print(Laboratory().status())
    elif arguments.command == "verify":
        report = verify_acceptance()
        _print(report)
        if not report["passed"]:
            raise SystemExit(1)
    elif arguments.command == "serve":
        import uvicorn

        uvicorn.run(
            "reasoning_lab.api:app",
            host=arguments.host,
            port=arguments.port,
            reload=False,
        )
    else:  # pragma: no cover - argparse enforces a command
        raise AssertionError(f"Unhandled command: {arguments.command}")


if __name__ == "__main__":
    main()
