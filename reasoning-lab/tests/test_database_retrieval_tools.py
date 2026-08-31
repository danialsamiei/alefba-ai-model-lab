from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from reasoning_lab.db import LabRepository
from reasoning_lab.retrieval import Retriever, build_fts_query, extract_variables
from reasoning_lab.tools import ToolRequest, ToolRuntime, parse_tool_call


@pytest.fixture()
def repository(tmp_path: Path) -> LabRepository:
    repo = LabRepository(tmp_path / "lab.sqlite3")
    repo.initialize()
    dataset_id = repo.register_dataset(dataset_hash="a" * 64, config={"seed": 7})
    repo.put_world(
        world_id="world_test",
        dataset_version_id=dataset_id,
        split="iid_test",
        facts={"A": 3, "B": 5, "C": 2},
    )
    for variable, value in {"A": 3, "B": 5, "C": 2}.items():
        repo.put_document(
            document_id=f"doc_{variable}",
            world_id="world_test",
            variable=variable,
            value=value,
            content=f"Fact {variable}: variable {variable} has value {value}.",
            source_uri=f"microworld://world_test/{variable}",
        )
    repo.put_episode(
        episode_id="episode_test",
        dataset_version_id=dataset_id,
        world_id="world_test",
        split="iid_test",
        expression="MUL(ADD(A,B),C)",
        expression_depth=2,
        prompt_text="A=3 B=5 C=2 MUL(ADD(A,B),C)",
        gold_answer=6,
        canonical_trace=["GET A 3", "GET B 5", "ADD 3 5 8", "GET C 2", "MUL 8 2 6"],
    )
    return repo


def test_public_episode_cannot_leak_evaluation_fields(repository: LabRepository) -> None:
    public = repository.public_episode("episode_test")
    assert "gold_answer" not in public
    assert "canonical_trace" not in public
    assert repository.gold_label("episode_test")[0] == 6


def test_fts_retrieval_is_world_scoped_and_auditable(repository: LabRepository) -> None:
    assert extract_variables("MUL(ADD(A,B),A)") == ("A", "B")
    assert build_fts_query("ADD(A,B)") == '"A" OR "B"'
    result = Retriever(repository).retrieve(
        expression="ADD(A,B)", world_id="world_test", mode="fts5", top_k=8
    )
    assert {hit.variable for hit in result.hits} == {"A", "B"}
    assert "gold" not in result.context.lower()
    assert repository.table_counts()["retrieval_events"] == 1


def test_only_allowlisted_typed_tools_execute() -> None:
    runtime = ToolRuntime({"A": 3}, max_calls=3)
    assert runtime.execute(parse_tool_call("<CALL> LOOKUP A <EOT>")).value == 3
    assert runtime.execute(parse_tool_call("CALC SUB 2 5")).value == 7
    rejected = runtime.execute(ToolRequest("SHELL", {"command": "whoami"}))
    assert rejected.status == "rejected"
    assert runtime.execute(ToolRequest("LOOKUP", {"variable": "A"})).status == "budget_exhausted"


def test_repository_rolls_back_invalid_records(repository: LabRepository) -> None:
    with pytest.raises(sqlite3.IntegrityError):
        repository.put_world(
            world_id="bad", dataset_version_id="missing", split="train", facts={"A": 1}
        )
    assert repository.table_counts()["worlds"] == 1
