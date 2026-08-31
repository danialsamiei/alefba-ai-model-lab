from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, cast

from digit_lm.api import create_app, resolve_latest_checkpoint
from digit_lm.checkpoint import load_checkpoint
from digit_lm.config import load_project_config
from digit_lm.data import build_all_datasets
from digit_lm.db import Database
from digit_lm.inference import InferenceService
from digit_lm.lab import run_laboratory
from digit_lm.paths import (
    DEFAULT_ARTIFACTS_ROOT,
    DEFAULT_CONFIG_PATH,
    DEFAULT_DATA_ROOT,
    DEFAULT_DATABASE_PATH,
)


def _path(value: str) -> Path:
    return Path(value).expanduser().resolve()


def _print_json(value: Any) -> None:
    print(json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="digit-lm",
        description="آزمایشگاه میکروسکوپی مدل زبانی با واژگان ده‌رقمی",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    data = subparsers.add_parser("build-data", help="ساخت JSONL، manifest و SQLite")
    data.add_argument("--config", type=_path, default=DEFAULT_CONFIG_PATH)
    data.add_argument("--database", type=_path, default=DEFAULT_DATABASE_PATH)
    data.add_argument("--data-root", type=_path, default=DEFAULT_DATA_ROOT)
    data.add_argument("--reset", action="store_true")

    lab = subparsers.add_parser("run-lab", help="اجرای pretrain، fine-tune و کنترل‌ها")
    lab.add_argument("--config", type=_path, default=DEFAULT_CONFIG_PATH)
    lab.add_argument("--database", type=_path, default=DEFAULT_DATABASE_PATH)
    lab.add_argument("--data-root", type=_path, default=DEFAULT_DATA_ROOT)
    lab.add_argument("--artifacts-root", type=_path, default=DEFAULT_ARTIFACTS_ROOT)
    lab.add_argument("--reset", action="store_true")
    lab.add_argument("--quick", action="store_true", help="اجرای کوتاه و غیرقابل‌تحویل")

    predict = subparsers.add_parser("predict", help="تولید عدد بعدی")
    predict.add_argument("digit")
    predict.add_argument("--checkpoint", type=_path)
    predict.add_argument(
        "--profile",
        choices=[
            "canonical",
            "canonical_pretrained",
            "random_init_sft",
            "holdout",
            "mapping_holdout",
            "corrupt",
        ],
        default="canonical",
    )
    predict.add_argument("--artifacts-root", type=_path, default=DEFAULT_ARTIFACTS_ROOT)
    predict.add_argument("--trace", action=argparse.BooleanOptionalAction, default=True)

    inspect = subparsers.add_parser("inspect", help="بررسی next-token برای context چندرقمی")
    inspect.add_argument("context")
    inspect.add_argument("--checkpoint", type=_path)
    inspect.add_argument(
        "--profile",
        choices=[
            "canonical",
            "canonical_pretrained",
            "random_init_sft",
            "holdout",
            "mapping_holdout",
            "corrupt",
        ],
        default="canonical",
    )
    inspect.add_argument("--artifacts-root", type=_path, default=DEFAULT_ARTIFACTS_ROOT)
    inspect.add_argument("--trace", action=argparse.BooleanOptionalAction, default=True)

    serve = subparsers.add_parser("serve", help="اجرای API و رابط وب محلی")
    serve.add_argument("--checkpoint", type=_path)
    serve.add_argument(
        "--profile",
        choices=[
            "canonical",
            "canonical_pretrained",
            "random_init_sft",
            "holdout",
            "mapping_holdout",
            "corrupt",
        ],
        default="canonical",
    )
    serve.add_argument("--database", type=_path, default=DEFAULT_DATABASE_PATH)
    serve.add_argument("--artifacts-root", type=_path, default=DEFAULT_ARTIFACTS_ROOT)
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8000)

    summary = subparsers.add_parser("db-summary", help="خلاصهٔ دفتر آزمایش SQLite")
    summary.add_argument("--database", type=_path, default=DEFAULT_DATABASE_PATH)
    return parser


def _checkpoint_from_args(args: argparse.Namespace) -> Path:
    if args.checkpoint is not None:
        return cast(Path, args.checkpoint)
    return resolve_latest_checkpoint(cast(Path, args.artifacts_root), cast(str, args.profile))


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    if args.command == "build-data":
        config = load_project_config(args.config)
        database = Database(args.database)
        database.initialize(reset=args.reset)
        manifests = build_all_datasets(
            database, args.data_root, context_length=config.model.context_length
        )
        _print_json({"database": str(database.path), "datasets": manifests})
        return
    if args.command == "run-lab":
        report = run_laboratory(
            config_path=args.config,
            database_path=args.database,
            data_root=args.data_root,
            artifacts_root=args.artifacts_root,
            reset_database=args.reset,
            quick=args.quick,
        )
        _print_json(
            {
                "status": report["status"],
                "acceptance": report["acceptance"],
                "latest": report["latest"],
                "report": str(
                    args.artifacts_root
                    / str(report["latest"].get("report", {}).get("markdown_path", "lab-report.md"))
                ),
            }
        )
        return
    if args.command in {"predict", "inspect"}:
        loaded = load_checkpoint(_checkpoint_from_args(args))
        service = InferenceService(loaded.model, loaded.metadata)
        result = (
            service.generate_successor(args.digit, include_trace=args.trace)
            if args.command == "predict"
            else service.inspect_context(args.context, include_trace=args.trace)
        )
        _print_json(result)
        return
    if args.command == "serve":
        import uvicorn

        checkpoint = _checkpoint_from_args(args)
        app = create_app(checkpoint_dir=checkpoint, database_path=args.database)
        uvicorn.run(app, host=args.host, port=args.port, log_level="info")
        return
    if args.command == "db-summary":
        database = Database(args.database)
        if not database.path.exists():
            parser.error("DATABASE_NOT_FOUND_RUN_BUILD_DATA_OR_RUN_LAB")
        _print_json(database.summary())
        return
    parser.error(f"UNKNOWN_COMMAND: {args.command}")
