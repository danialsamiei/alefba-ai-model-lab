"""Inspectable retrieval pipeline for the micro reasoning world.

This is intentionally a classical FTS5 RAG pipeline: retrieval happens outside
the neural network and the returned documents are injected into its prompt.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from time import perf_counter
from typing import Literal

from .db import LabRepository, RetrievalHit

RetrievalMode = Literal["none", "fts5", "oracle"]
VARIABLE_RE = re.compile(r"\b([A-H])\b")


@dataclass(frozen=True)
class RetrievalResult:
    method: RetrievalMode
    query: str
    hits: tuple[RetrievalHit, ...]
    context: str
    elapsed_ms: float


def extract_variables(expression: str) -> tuple[str, ...]:
    """Extract unique allow-listed variables in their first-use order."""
    return tuple(dict.fromkeys(VARIABLE_RE.findall(expression)))


def build_fts_query(expression: str) -> str:
    variables = extract_variables(expression)
    return " OR ".join(f'"{variable}"' for variable in variables)


class Retriever:
    def __init__(self, repository: LabRepository) -> None:
        self.repository = repository

    def retrieve(
        self,
        *,
        expression: str,
        world_id: str,
        mode: RetrievalMode = "fts5",
        top_k: int = 8,
        trace_id: str | None = None,
        record: bool = True,
    ) -> RetrievalResult:
        started = perf_counter()
        query = build_fts_query(expression)
        hits: list[RetrievalHit]
        if mode == "none":
            hits = []
        elif mode == "fts5":
            hits = self.repository.retrieve_fts(world_id=world_id, query=query, top_k=top_k)
        elif mode == "oracle":
            # Oracle retrieval is an evaluation ceiling.  It reads the complete
            # world and must never be reported as a model-only result.
            expected = set(extract_variables(expression))
            hits = [
                hit
                for variable in sorted(expected)
                for hit in self.repository.retrieve_fts(
                    world_id=world_id, query=f'"{variable}"', top_k=1
                )
            ]
        else:
            raise ValueError(f"Unknown retrieval mode: {mode}")

        elapsed_ms = (perf_counter() - started) * 1000.0
        context = "\n".join(hit.content for hit in hits)
        result = RetrievalResult(mode, query, tuple(hits), context, elapsed_ms)
        if record:
            self.repository.record_retrieval(
                trace_id=trace_id,
                world_id=world_id,
                method=mode,
                query_text=query,
                elapsed_ms=elapsed_ms,
                hits=result.hits,
                top_k=top_k,
            )
        return result
