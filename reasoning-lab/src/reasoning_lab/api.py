"""Local FastAPI surface for the visual reasoning laboratory."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field, field_validator
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from reasoning_lab.lab import ALL_PROFILES, Laboratory
from reasoning_lab.sampling_lab import SamplingParameters, run_sampling_lab

STATIC_ROOT = Path(__file__).with_name("static")


class SolveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model: Literal["ngram", "window_mlp", "dense_direct", "dense_scratch", "moe_scratch"]
    mode: Literal["model_only", "rag", "tools", "oracle"]
    effort: Literal["low", "medium", "high"]
    expression: str = Field(min_length=1, max_length=256)
    facts: dict[str, int]
    capture: bool = True

    @field_validator("facts")
    @classmethod
    def validate_facts(cls, value: dict[str, int]) -> dict[str, int]:
        if len(value) > 8:
            raise ValueError("At most eight facts are accepted")
        for key, item in value.items():
            if key not in tuple("ABCDEFGH"):
                raise ValueError("Fact keys must be A through H")
            if isinstance(item, bool) or not 0 <= item <= 9:
                raise ValueError("Fact values must be integers from 0 through 9")
        return value


class SamplingLabRequest(BaseModel):
    """Strict input contract for the independent digit-sampling laboratory."""

    model_config = ConfigDict(extra="forbid")

    current_digit: int = Field(default=4, ge=0, le=9)
    history: str = Field(default="11234", max_length=64, pattern=r"^[0-9]*$")
    temperature: float = Field(default=1.0, ge=0, le=2)
    top_k: int = Field(default=0, ge=0, le=10)
    top_p: float = Field(default=1.0, ge=0.01, le=1)
    min_p: float = Field(default=0.0, ge=0, le=1)
    typical_p: float = Field(default=1.0, ge=0.01, le=1)
    epsilon_cutoff: float = Field(default=0.0, ge=0, le=0.5)
    eta_cutoff: float = Field(default=0.0, ge=0, le=0.5)
    presence_penalty: float = Field(default=0.0, ge=-2, le=2)
    frequency_penalty: float = Field(default=0.0, ge=-2, le=2)
    repetition_penalty: float = Field(default=1.0, ge=0.1, le=2)
    bias_digit: int = Field(default=0, ge=0, le=9)
    logit_bias: float = Field(default=0.0, ge=-5, le=5)
    seed: int = Field(default=20260831, ge=0, le=2**32 - 1)
    sample_count: int = Field(default=1000, ge=100, le=2000)

    def parameters(self) -> SamplingParameters:
        return SamplingParameters(**self.model_dump())


class GuardMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: Any, *, body_limit: int) -> None:
        super().__init__(app)
        self.body_limit = body_limit

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        content_length = request.headers.get("content-length")
        if content_length is not None:
            try:
                too_large = int(content_length) > self.body_limit
            except ValueError:
                return JSONResponse({"detail": "Invalid Content-Length"}, status_code=400)
            if too_large:
                return JSONResponse({"detail": "Request body too large"}, status_code=413)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cache-Control"] = "no-store"
        return response


def create_app(laboratory: Laboratory | None = None) -> FastAPI:
    lab = laboratory or Laboratory()
    app = FastAPI(
        title="Micro Reasoning Lab",
        version="0.1.0",
        description="Local inspectable lab; generated traces are not hidden thoughts.",
    )
    app.state.laboratory = lab
    app.add_middleware(GuardMiddleware, body_limit=lab.config.lab.body_limit_bytes)
    app.mount("/static", StaticFiles(directory=STATIC_ROOT), name="static")

    @app.exception_handler(FileNotFoundError)
    async def checkpoint_unavailable(_: Request, error: FileNotFoundError) -> JSONResponse:
        return JSONResponse(
            {"detail": str(error), "capability_status": "UNAVAILABLE"},
            status_code=409,
        )

    @app.exception_handler(ValueError)
    async def invalid_lab_input(_: Request, error: ValueError) -> JSONResponse:
        return JSONResponse({"detail": str(error)}, status_code=422)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(_: Request, error: RequestValidationError) -> JSONResponse:
        return JSONResponse({"detail": error.errors()}, status_code=422)

    @app.get("/", include_in_schema=False)
    async def index() -> FileResponse:
        return FileResponse(STATIC_ROOT / "index.html")

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/ready")
    async def ready() -> dict[str, Any]:
        return {
            "status": "ready",
            "database_initialized": True,
            "models_ready": list(lab.registry.available()),
        }

    @app.get("/api/status")
    async def status() -> dict[str, Any]:
        return lab.status()

    @app.get("/api/database/counts")
    async def database_counts() -> dict[str, int]:
        return lab.repository.table_counts()

    @app.get("/api/models")
    async def models() -> dict[str, Any]:
        available = set(lab.registry.available())
        return {
            "models": [
                {
                    "profile": profile,
                    "available": profile in available,
                    "objective": (
                        "scratch" if profile in {"dense_scratch", "moe_scratch"} else "direct"
                    ),
                }
                for profile in ALL_PROFILES
            ]
        }

    @app.post("/api/solve")
    async def solve(request: SolveRequest) -> dict[str, Any]:
        return lab.solve(
            model=request.model,
            mode=request.mode,
            effort=request.effort,
            expression=request.expression,
            facts=request.facts,
            capture=request.capture,
        )

    @app.post("/api/sampling-lab")
    async def sampling_lab(request: SamplingLabRequest) -> dict[str, Any]:
        return run_sampling_lab(request.parameters())

    return app


app = create_app()


__all__ = ["SamplingLabRequest", "SolveRequest", "app", "create_app"]
