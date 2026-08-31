from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator

import httpx
from fastapi.testclient import TestClient

from digit_lm.api import create_app
from digit_lm.db import Database
from digit_lm.training import TrainResult


def test_api_health_model_prediction_and_static_ui(
    trained_lab: tuple[TrainResult, Database],
) -> None:
    result, database = trained_lab
    client = TestClient(
        create_app(checkpoint_dir=result.checkpoint_dir, database_path=database.path)
    )
    assert client.get("/healthz").json() == {"status": "ok"}
    assert client.get("/readyz").status_code == 200
    model = client.get("/api/model").json()
    assert model["vocabulary"] == list("0123456789")
    assert model["special_tokens"] == []
    prediction = client.post("/api/predict", json={"digit": "9", "include_trace": True})
    assert prediction.status_code == 200
    body = prediction.json()
    assert body["raw_output"] == "10"
    assert body["display_output"] == "10"
    assert body["post_generation_oracle"]["used_for_generation"] is False
    assert len(body["steps"]) == 2
    assert len(body["steps"][1]["trace"]["layers"]) == 1
    index = client.get("/")
    assert index.status_code == 200
    assert "میکروسکوپ" in index.text
    assert "fonts.googleapis.com" not in index.text
    assert "fonts.gstatic.com" not in index.text
    local_font = client.get("/static/fonts/vazirmatn-arabic-wght-normal.woff2")
    assert local_font.status_code == 200
    assert local_font.headers["content-type"] == "font/woff2"


def test_invalid_inputs_are_rejected_and_logged_without_prediction(
    trained_lab: tuple[TrainResult, Database],
) -> None:
    result, database = trained_lab
    client = TestClient(
        create_app(checkpoint_dir=result.checkpoint_dir, database_path=database.path)
    )
    before = database.summary()["inference_request_count"]
    for invalid in ("", "10", "۹", "A", " 4"):
        response = client.post("/api/predict", json={"digit": invalid, "include_trace": False})
        assert response.status_code == 422
    after = database.summary()["inference_request_count"]
    assert after - before == 5

    oversized = client.post("/api/predict", json={"digit": "9" * 10_000, "include_trace": False})
    assert oversized.status_code == 413
    assert len(oversized.content) < 200
    unexpected = client.post(
        "/api/predict",
        json={"digit": "4", "include_trace": False, "unexpected": "x"},
    )
    assert unexpected.status_code == 422
    assert database.summary()["inference_request_count"] == after


def test_context_inspector_enforces_the_eight_token_window(
    trained_lab: tuple[TrainResult, Database],
) -> None:
    result, database = trained_lab
    client = TestClient(
        create_app(checkpoint_dir=result.checkpoint_dir, database_path=database.path)
    )
    assert (
        client.post(
            "/api/inspect", json={"context": "01234567", "include_trace": False}
        ).status_code
        == 200
    )
    rejected = client.post("/api/inspect", json={"context": "012345678", "include_trace": False})
    assert rejected.status_code == 422


def test_chunked_body_without_content_length_is_bounded_at_asgi_receive(
    trained_lab: tuple[TrainResult, Database],
) -> None:
    result, _database = trained_lab

    async def chunked_json() -> AsyncIterator[bytes]:
        yield b'{"digit":"'
        yield b"9" * 10_000
        yield b'","include_trace":false}'

    async def scenario() -> None:
        app = create_app(checkpoint_dir=result.checkpoint_dir, database_path=None)
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/predict",
                content=chunked_json(),
                headers={"content-type": "application/json"},
            )
        assert "content-length" not in response.request.headers
        assert response.request.headers["transfer-encoding"] == "chunked"
        assert response.status_code == 413
        assert response.json() == {"detail": {"code": "REQUEST_BODY_TOO_LARGE"}}
        assert len(response.content) < 200

    asyncio.run(scenario())
