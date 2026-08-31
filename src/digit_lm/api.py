from __future__ import annotations

import mimetypes
import time
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from digit_lm.checkpoint import load_checkpoint
from digit_lm.db import Database
from digit_lm.inference import InferenceService
from digit_lm.tokenizer import TokenizerError

# Windows does not consistently register the WOFF2 media type.  Register it
# explicitly so the offline UI serves its bundled fonts with the correct MIME
# type on every supported platform.
mimetypes.add_type("font/woff2", ".woff2")


class PredictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    digit: str = Field(
        max_length=64,
        description="Exactly one ASCII digit from 0 through 9; bounded before audit logging",
    )
    include_trace: bool = True


class InspectRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    context: str = Field(max_length=8, description="One to eight ASCII digits")
    include_trace: bool = True


class RequestBodyLimitMiddleware:
    """Buffer bounded JSON bodies before FastAPI parses them, then replay the messages."""

    def __init__(self, app: ASGIApp, *, max_body_bytes: int) -> None:
        self.app = app
        self.max_body_bytes = max_body_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        raw_length = dict(scope.get("headers", [])).get(b"content-length")
        if raw_length is not None:
            try:
                declared_length = int(raw_length)
            except ValueError:
                await self._reject(scope, receive, send, 400, "INVALID_CONTENT_LENGTH")
                return
            if declared_length > self.max_body_bytes:
                await self._reject(scope, receive, send, 413, "REQUEST_BODY_TOO_LARGE")
                return

        received = 0
        buffered: list[Message] = []
        while True:
            message = await receive()
            buffered.append(message)
            if message["type"] != "http.request":
                break
            received += len(message.get("body", b""))
            if received > self.max_body_bytes:
                await self._reject(scope, receive, send, 413, "REQUEST_BODY_TOO_LARGE")
                return
            if not message.get("more_body", False):
                break

        replay_index = 0

        async def replay_receive() -> Message:
            nonlocal replay_index
            if replay_index < len(buffered):
                message = buffered[replay_index]
                replay_index += 1
                return message
            return await receive()

        await self.app(scope, replay_receive, send)

    @staticmethod
    async def _reject(
        scope: Scope,
        receive: Receive,
        send: Send,
        status_code: int,
        code: str,
    ) -> None:
        response = JSONResponse(status_code=status_code, content={"detail": {"code": code}})
        await response(scope, receive, send)


def resolve_latest_checkpoint(artifacts_root: Path, profile: str = "canonical") -> Path:
    import json

    pointer_path = artifacts_root / "latest.json"
    if not pointer_path.exists():
        raise FileNotFoundError("NO_TRAINED_CHECKPOINT_RUN_DIGIT_LM_RUN_LAB_FIRST")
    pointer = json.loads(pointer_path.read_text(encoding="utf-8"))
    if profile not in pointer:
        raise KeyError(f"UNKNOWN_CHECKPOINT_PROFILE: {profile}")
    return artifacts_root / str(pointer[profile]["checkpoint_dir"])


def create_app(
    *,
    checkpoint_dir: Path,
    database_path: Path | None,
) -> FastAPI:
    loaded = load_checkpoint(checkpoint_dir)
    service = InferenceService(loaded.model, loaded.metadata)
    database = (
        Database(database_path) if database_path is not None and database_path.exists() else None
    )
    static_dir = Path(__file__).with_name("ui")

    app = FastAPI(
        title="Digit LM Microscope",
        version="0.1.0",
        description="A ten-token decoder-only Transformer laboratory.",
    )
    app.add_middleware(RequestBodyLimitMiddleware, max_body_bytes=4096)
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

    @app.get("/", include_in_schema=False)
    def index() -> FileResponse:
        return FileResponse(static_dir / "index.html")

    @app.get("/healthz")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/readyz")
    def ready() -> dict[str, Any]:
        return {
            "status": "ready",
            "run_id": loaded.metadata["run_id"],
            "checkpoint_verified": True,
        }

    @app.get("/api/model")
    def model_info() -> dict[str, Any]:
        return {
            "run_id": loaded.metadata["run_id"],
            "stage": loaded.metadata["stage"],
            "checkpoint_sha256": loaded.metadata["checkpoint_sha256"],
            "tensor_sha256": loaded.metadata["tensor_sha256"],
            "parent_run_id": loaded.metadata.get("parent_run_id"),
            "dataset_id": loaded.metadata["dataset_id"],
            "parameter_count": loaded.metadata["parameter_count"],
            "model_config": loaded.metadata["model_config"],
            "vocabulary": list("0123456789"),
            "special_tokens": [],
            "generation_protocol": "two_tokens_without_eos",
            "limitations": [
                "The full model saw all ten mappings during fine-tuning.",
                "Attention is telemetry, not a causal explanation.",
                "One-token attention is necessarily 1.0.",
            ],
        }

    @app.post("/api/predict")
    def predict(request: PredictRequest) -> dict[str, Any]:
        started = time.perf_counter()
        try:
            prediction = service.generate_successor(
                request.digit, include_trace=request.include_trace
            )
        except TokenizerError as error:
            duration = (time.perf_counter() - started) * 1000
            if database is not None:
                database.log_inference(
                    run_id=str(loaded.metadata["run_id"]),
                    raw_input=request.digit,
                    accepted=False,
                    rejection_code=error.code,
                    duration_ms=duration,
                )
            raise HTTPException(
                status_code=422, detail={"code": error.code, "input": request.digit}
            ) from error
        duration = (time.perf_counter() - started) * 1000
        prediction["duration_ms"] = round(duration, 3)
        if database is not None:
            database.log_inference(
                run_id=str(loaded.metadata["run_id"]),
                raw_input=request.digit,
                accepted=True,
                predicted_text=str(prediction["raw_output"]),
                duration_ms=duration,
            )
        return prediction

    @app.post("/api/inspect")
    def inspect(request: InspectRequest) -> dict[str, Any]:
        try:
            return service.inspect_context(request.context, include_trace=request.include_trace)
        except TokenizerError as error:
            raise HTTPException(
                status_code=422, detail={"code": error.code, "input": request.context}
            ) from error
        except ValueError as error:
            raise HTTPException(
                status_code=422, detail={"code": str(error), "input": request.context}
            ) from error

    @app.get("/api/lab/summary")
    def lab_summary() -> dict[str, Any]:
        if database is None:
            return {"available": False, "reason": "DATABASE_NOT_ATTACHED"}
        return {"available": True, **database.summary()}

    @app.get("/api/runs/{run_id}/metrics")
    def run_metrics(run_id: str) -> dict[str, Any]:
        if database is None:
            raise HTTPException(status_code=404, detail="DATABASE_NOT_ATTACHED")
        try:
            run = database.run(run_id)
        except KeyError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error
        return {"run": run, "metrics": database.metrics_for_run(run_id)}

    @app.get("/api/datasets/{dataset_name}")
    def dataset_rows(dataset_name: str) -> dict[str, Any]:
        if database is None:
            raise HTTPException(status_code=404, detail="DATABASE_NOT_ATTACHED")
        try:
            dataset = database.dataset_by_name(dataset_name)
        except KeyError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error
        return {"dataset": dataset, "examples": database.load_examples(dataset_name)}

    return app
