from reasoning_lab.acceptance import Gate


def test_gate_serialization_keeps_evidence_and_status() -> None:
    gate = Gate("X-001", True, {"count": 3}, "example")
    assert gate.to_dict() == {
        "gate_id": "X-001",
        "passed": True,
        "evidence": {"count": 3},
        "note": "example",
    }
