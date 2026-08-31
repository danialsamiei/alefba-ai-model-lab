from collections.abc import Mapping
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from reasoning_lab.api import create_app
from reasoning_lab.db import LabRepository
from reasoning_lab.inference import Effort
from reasoning_lab.lab import CheckpointRegistry, Laboratory, _decoding_payload


def client(tmp_path: Path) -> TestClient:
    laboratory = Laboratory(
        repository=LabRepository(tmp_path / "lab.sqlite3"),
        registry=CheckpointRegistry(tmp_path / "registry.json"),
    )
    return TestClient(create_app(laboratory))


def test_health_static_and_status(tmp_path: Path) -> None:
    with client(tmp_path) as browser:
        assert browser.get("/api/health").json() == {"status": "ok"}
        assert browser.get("/").status_code == 200
        status = browser.get("/api/status").json()
        assert status["models_ready"] == 0
        assert status["database_counts"]["worlds"] == 0
        assert status["corpus_summary"]["total_episodes"] == 1720
        assert status["corpus_summary"]["training_examples"] == 5160
        assert status["corpus_summary"]["objectives_per_episode"] == [
            "direct",
            "scratch",
            "tool",
        ]
        assert status["model_config"]["n_experts"] == 4


def test_oracle_and_tool_modes_are_separate(tmp_path: Path) -> None:
    payload = {
        "model": "dense_scratch",
        "expression": "MUL(ADD(A,B),C)",
        "facts": {"A": 3, "B": 5, "C": 2},
        "effort": "low",
        "capture": True,
    }
    with client(tmp_path) as browser:
        oracle = browser.post("/api/solve", json={**payload, "mode": "oracle"})
        assert oracle.status_code == 200
        oracle_body = oracle.json()
        assert oracle_body["answer"] == 6
        assert oracle_body["schema_version"] == "solve-v2"
        assert oracle_body["execution"] == {
            "path": ["input", "oracle", "answer"],
            "answer_source": "oracle",
            "objective": None,
            "model_invoked": False,
        }
        assert oracle_body["tokenization"]["consumed_by_model"] is False
        assert oracle_body["tokenization"]["prefix_tokens"] == []
        assert oracle_body["decoding"]["probability_basis"] == "not_applicable"
        assert oracle_body["verification"]["applicable"] is False
        assert oracle_body["verification"]["passes"] == 0
        assert oracle_body["expression_ast"]["operator"] == "MUL"
        assert oracle_body["canonical_reference"]["phase"] == "after_inference"
        assert oracle_body["canonical_reference"]["answer"] == 6
        assert oracle_body["canonical_reference"]["trace_steps"][-1]["value"] == 6
        tools = browser.post("/api/solve", json={**payload, "mode": "tools"})
        assert tools.status_code == 200
        body = tools.json()
        assert body["answer"] == 6
        assert body["learned_policy"] is False
        assert len(body["tool_calls"]) == 5
        assert body["execution"] == {
            "path": ["input", "tools", "answer"],
            "answer_source": "scripted_tool_controller",
            "objective": None,
            "model_invoked": False,
        }
        assert body["tokenization"]["consumed_by_model"] is False
        assert body["selection"]["applicable"] is False
        assert body["verification"]["kind"] == "not_applicable"
        assert body["correct"] is True


def test_rag_solve_v2_reports_exact_injected_model_input_and_direct_semantics(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    laboratory = Laboratory(
        repository=LabRepository(tmp_path / "lab.sqlite3"),
        registry=CheckpointRegistry(tmp_path / "registry.json"),
    )

    def fake_run_model(
        *,
        profile: str,
        prompt_text: str,
        expression: str,
        facts: Mapping[str, int],
        effort: Effort,
        capture: bool,
    ) -> dict[str, Any]:
        assert profile == "dense_direct"
        assert expression == "ADD(A,B)"
        assert facts["A"] == 1 and facts["B"] == 2
        assert effort == "low" and capture
        assert prompt_text.startswith("WORLD(")
        candidate = {
            "output_text": "<FINAL>3",
            "final_answer": 3,
            "normalized_logprob": -0.1,
            "protocol_valid": True,
            "verifier_score": 0.5,
            "generated_tokens": 1,
            "forward_passes": 1,
            "selected": True,
            "metadata": {},
        }
        return {
            "answer": 3,
            "output_text": "<FINAL>3",
            "scratchpad": None,
            "trace_steps": [],
            "protocol_valid": True,
            "effort": effort,
            "candidates": [candidate],
            "selected_index": 0,
            "elapsed_ms": 1.0,
            "total_generated_tokens": 1,
            "total_forward_passes": 1,
            "verifier_passes": 1,
            "total_host_framing_tokens": 4,
            "token_steps": [],
            "attention": None,
            "routing": [],
            "visual_trace": None,
            "checkpoint_sha256": "fake-checkpoint",
        }

    monkeypatch.setattr(laboratory, "_run_model", fake_run_model)
    with TestClient(create_app(laboratory)) as browser:
        response = browser.post(
            "/api/solve",
            json={
                "model": "dense_direct",
                "mode": "rag",
                "effort": "low",
                "expression": "ADD(A,B)",
                "facts": {"A": 1, "B": 2},
                "capture": True,
            },
        )
    assert response.status_code == 200
    body = response.json()
    assert body["execution"]["path"] == [
        "input",
        "retrieval",
        "tokenization",
        "model",
        "attention_or_mlp",
        "candidates",
        "answer",
    ]
    assert body["execution"]["answer_source"] == "rag_model"
    assert body["execution"]["objective"] == "direct"
    assert body["execution"]["model_invoked"] is True
    tokenization = body["tokenization"]
    assert tokenization["consumed_by_model"] is True
    assert tokenization["prompt_text"] == body["retrieval"]["injected_prompt"]
    assert tokenization["prefix_tokens"][0]["token_text"] == "<BOS>"
    assert tokenization["prefix_tokens"][0]["origin"] == "host_protocol"
    assert tokenization["prefix_tokens"][-1]["token_text"] == "<FINAL>"
    for token in tokenization["prefix_tokens"]:
        assert laboratory.tokenizer.token_for_id(token["token_id"]) == token["token_text"]
    assert body["retrieval"]["model_facts"]["A"] == 1
    assert body["retrieval"]["model_facts"]["B"] == 2
    assert set(body["retrieval"]["model_facts"]) == {"A", "B"}
    assert body["retrieval"]["missing_variables"] == []
    assert body["decoding"] == {
        "probability_basis": "post_constraint_temperature_top_k",
        "constraint": "digits_0_9",
        "temperature": 0.0,
        "top_k": 1,
    }
    assert body["selection"]["majority_answer"] == 3
    assert body["selection"]["ordered_criteria"][0] == "protocol_valid"
    assert body["verification"]["applicable"] is False
    assert body["verification"]["passes"] == 0
    assert body["verification"]["legacy_reported_passes"] == 1
    assert body["canonical_reference"]["answer"] == 3


def test_scratch_decoding_reports_per_slot_grammar_constraint() -> None:
    assert _decoding_payload(
        model="dense_scratch",
        effort="medium",
        model_invoked=True,
        objective="scratch",
    ) == {
        "probability_basis": "post_constraint_temperature_top_k",
        "constraint": "grammar_constrained_slots",
        "temperature": 0.75,
        "top_k": 8,
    }


def test_missing_checkpoint_fails_closed(tmp_path: Path) -> None:
    with client(tmp_path) as browser:
        response = browser.post(
            "/api/solve",
            json={
                "model": "dense_direct",
                "mode": "model_only",
                "effort": "low",
                "expression": "ADD(A,B)",
                "facts": {"A": 1, "B": 2},
                "capture": False,
            },
        )
    assert response.status_code == 409
    assert response.json()["capability_status"] == "UNAVAILABLE"


def test_request_contract_rejects_unknown_fields(tmp_path: Path) -> None:
    with client(tmp_path) as browser:
        response = browser.post(
            "/api/solve",
            json={
                "model": "ngram",
                "mode": "oracle",
                "effort": "low",
                "expression": "A",
                "facts": {"A": 1},
                "capture": False,
                "shell": "whoami",
            },
        )
    assert response.status_code == 422


def test_sampling_lab_endpoint_returns_all_digit_stages(tmp_path: Path) -> None:
    with client(tmp_path) as browser:
        response = browser.post(
            "/api/sampling-lab",
            json={
                "current_digit": 8,
                "history": "778",
                "temperature": 0.7,
                "top_k": 4,
                "top_p": 0.9,
                "min_p": 0.05,
                "typical_p": 1,
                "epsilon_cutoff": 0,
                "eta_cutoff": 0,
                "presence_penalty": 0.2,
                "frequency_penalty": 0.1,
                "repetition_penalty": 1.1,
                "bias_digit": 9,
                "logit_bias": 0.4,
                "seed": 42,
                "sample_count": 200,
            },
        )
    assert response.status_code == 200
    body = response.json()
    assert body["format"] == "sampling-lab-v1"
    assert body["input"]["expected_successor"] == 9
    assert body["operation_order"][-1] == "seeded_draw"
    assert len(body["stages"]) == 10
    assert all(len(item["values"]) == 10 for item in body["stages"])
    assert sum(body["result"]["histogram_counts"]) == 200


def test_sampling_lab_request_is_strict_and_bounded(tmp_path: Path) -> None:
    with client(tmp_path) as browser:
        invalid_digit = browser.post("/api/sampling-lab", json={"current_digit": 10})
        invalid_history = browser.post("/api/sampling-lab", json={"history": "1A"})
        unknown = browser.post("/api/sampling-lab", json={"shell": "whoami"})
    assert invalid_digit.status_code == 422
    assert invalid_history.status_code == 422
    assert unknown.status_code == 422
