"""Small, explicit SQLite repository used by the educational laboratory.

The repository deliberately keeps gold labels in a separate method from public
inference inputs.  That separation makes accidental answer leakage testable.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
from collections.abc import Iterable, Iterator, Mapping, Sequence
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

JsonMapping = Mapping[str, Any]


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex}"


@dataclass(frozen=True)
class RetrievalHit:
    document_id: str
    world_id: str
    variable: str
    value: int
    content: str
    source_uri: str
    content_hash: str
    score: float


class LabRepository:
    """Transactional access to the lab's reproducibility and telemetry store."""

    def __init__(self, path: Path | str) -> None:
        self.path = Path(path)

    def initialize(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        schema_path = Path(__file__).with_name("schema.sql")
        schema = schema_path.read_text(encoding="utf-8")
        with self.connect() as connection:
            connection.executescript(schema)
            fts5 = connection.execute("SELECT sqlite_compileoption_used('ENABLE_FTS5')").fetchone()[
                0
            ]
            if not fts5:
                raise RuntimeError("This SQLite build does not include FTS5")

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.path, timeout=5.0)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA busy_timeout = 5000")
        connection.execute("PRAGMA journal_mode = WAL")
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def register_dataset(
        self,
        *,
        dataset_hash: str,
        config: JsonMapping,
        manifest_path: str | None = None,
        dataset_id: str | None = None,
    ) -> str:
        identifier = dataset_id or f"ds_{dataset_hash[:16]}"
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO dataset_versions(id, dataset_hash, config_json, manifest_path, created_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(dataset_hash) DO UPDATE SET
                    config_json = excluded.config_json,
                    manifest_path = excluded.manifest_path
                """,
                (identifier, dataset_hash, _json(config), manifest_path, _now()),
            )
            row = connection.execute(
                "SELECT id FROM dataset_versions WHERE dataset_hash = ?", (dataset_hash,)
            ).fetchone()
        assert row is not None
        return str(row["id"])

    def put_world(
        self,
        *,
        world_id: str,
        dataset_version_id: str,
        split: str,
        facts: Mapping[str, int],
    ) -> None:
        normalized = {key: int(facts[key]) for key in sorted(facts)}
        facts_json = _json(normalized)
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO worlds(id, dataset_version_id, split, facts_json, facts_hash, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    split = excluded.split,
                    facts_json = excluded.facts_json,
                    facts_hash = excluded.facts_hash
                """,
                (
                    world_id,
                    dataset_version_id,
                    split,
                    facts_json,
                    _sha256_text(facts_json),
                    _now(),
                ),
            )

    def put_document(
        self,
        *,
        document_id: str,
        world_id: str,
        variable: str,
        value: int,
        content: str,
        source_uri: str,
        metadata: JsonMapping | None = None,
    ) -> None:
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO documents(
                    id, world_id, variable, value, content, content_hash,
                    source_uri, metadata_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    world_id = excluded.world_id,
                    variable = excluded.variable,
                    value = excluded.value,
                    content = excluded.content,
                    content_hash = excluded.content_hash,
                    source_uri = excluded.source_uri,
                    metadata_json = excluded.metadata_json
                """,
                (
                    document_id,
                    world_id,
                    variable,
                    value,
                    content,
                    _sha256_text(content),
                    source_uri,
                    _json(metadata or {}),
                    _now(),
                ),
            )

    def put_episode(
        self,
        *,
        episode_id: str,
        dataset_version_id: str,
        world_id: str,
        split: str,
        expression: str,
        expression_depth: int,
        prompt_text: str,
        gold_answer: int,
        canonical_trace: Sequence[JsonMapping] | Sequence[str],
        metadata: JsonMapping | None = None,
    ) -> None:
        episode_payload = _json(
            {
                "world_id": world_id,
                "expression": expression,
                "facts_prompt": prompt_text,
                "answer": gold_answer,
            }
        )
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO episodes(
                    id, dataset_version_id, world_id, split, expression,
                    expression_depth, prompt_text, gold_answer,
                    canonical_trace_json, episode_hash, metadata_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    prompt_text = excluded.prompt_text,
                    gold_answer = excluded.gold_answer,
                    canonical_trace_json = excluded.canonical_trace_json,
                    metadata_json = excluded.metadata_json
                """,
                (
                    episode_id,
                    dataset_version_id,
                    world_id,
                    split,
                    expression,
                    expression_depth,
                    prompt_text,
                    gold_answer,
                    _json(canonical_trace),
                    _sha256_text(episode_payload),
                    _json(metadata or {}),
                    _now(),
                ),
            )

    def put_training_example(
        self,
        *,
        example_id: str,
        episode_id: str,
        objective: str,
        token_ids: Sequence[int],
        loss_mask: Sequence[bool | int],
        metadata: JsonMapping | None = None,
    ) -> None:
        if len(token_ids) != len(loss_mask):
            raise ValueError("token_ids and loss_mask must have the same length")
        token_json = _json([int(value) for value in token_ids])
        mask_json = _json([bool(value) for value in loss_mask])
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO training_examples(
                    id, episode_id, objective, token_ids_json, loss_mask_json,
                    sequence_hash, metadata_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    token_ids_json = excluded.token_ids_json,
                    loss_mask_json = excluded.loss_mask_json,
                    sequence_hash = excluded.sequence_hash,
                    metadata_json = excluded.metadata_json
                """,
                (
                    example_id,
                    episode_id,
                    objective,
                    token_json,
                    mask_json,
                    _sha256_text(token_json + ":" + mask_json),
                    _json(metadata or {}),
                    _now(),
                ),
            )

    def public_episode(self, episode_id: str) -> dict[str, Any]:
        """Return inference inputs without any answer or canonical trace fields."""
        with self.connect() as connection:
            row = connection.execute(
                """
                SELECT id, world_id, split, expression, expression_depth,
                       prompt_text, metadata_json
                FROM episodes WHERE id = ?
                """,
                (episode_id,),
            ).fetchone()
        if row is None:
            raise KeyError(f"Unknown episode: {episode_id}")
        result = dict(row)
        result["metadata"] = json.loads(result.pop("metadata_json"))
        return result

    def gold_label(self, episode_id: str) -> tuple[int, list[Any]]:
        """Load evaluation-only data after inference has completed."""
        with self.connect() as connection:
            row = connection.execute(
                "SELECT gold_answer, canonical_trace_json FROM episodes WHERE id = ?",
                (episode_id,),
            ).fetchone()
        if row is None:
            raise KeyError(f"Unknown episode: {episode_id}")
        return int(row["gold_answer"]), json.loads(row["canonical_trace_json"])

    def list_public_episodes(self, *, split: str, limit: int | None = None) -> list[dict[str, Any]]:
        sql = """
            SELECT id, world_id, split, expression, expression_depth, prompt_text, metadata_json
            FROM episodes WHERE split = ? ORDER BY id
        """
        params: list[Any] = [split]
        if limit is not None:
            sql += " LIMIT ?"
            params.append(limit)
        with self.connect() as connection:
            rows = connection.execute(sql, params).fetchall()
        results: list[dict[str, Any]] = []
        for row in rows:
            item = dict(row)
            item["metadata"] = json.loads(item.pop("metadata_json"))
            results.append(item)
        return results

    def world_facts(self, world_id: str) -> dict[str, int]:
        with self.connect() as connection:
            row = connection.execute(
                "SELECT facts_json FROM worlds WHERE id = ?", (world_id,)
            ).fetchone()
        if row is None:
            raise KeyError(f"Unknown world: {world_id}")
        return {str(k): int(v) for k, v in json.loads(row["facts_json"]).items()}

    def retrieve_fts(self, *, world_id: str, query: str, top_k: int = 4) -> list[RetrievalHit]:
        if top_k < 0:
            raise ValueError("top_k must be non-negative")
        if top_k == 0 or not query.strip():
            return []
        with self.connect() as connection:
            rows = connection.execute(
                """
                SELECT d.id, d.world_id, d.variable, d.value, d.content,
                       d.source_uri, d.content_hash, bm25(documents_fts) AS score
                FROM documents_fts
                JOIN documents d ON d.id = documents_fts.document_id
                WHERE documents_fts MATCH ? AND documents_fts.world_id = ?
                ORDER BY score ASC, d.id ASC
                LIMIT ?
                """,
                (query, world_id, top_k),
            ).fetchall()
        return [
            RetrievalHit(
                document_id=str(row["id"]),
                world_id=str(row["world_id"]),
                variable=str(row["variable"]),
                value=int(row["value"]),
                content=str(row["content"]),
                source_uri=str(row["source_uri"]),
                content_hash=str(row["content_hash"]),
                score=float(row["score"]),
            )
            for row in rows
        ]

    def create_run(
        self,
        *,
        kind: str,
        config: JsonMapping,
        seed: int,
        model_kind: str | None = None,
        dataset_version_id: str | None = None,
        checkpoint_sha256: str | None = None,
    ) -> str:
        run_id = _id("run")
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO runs(
                    id, kind, model_kind, dataset_version_id, checkpoint_sha256,
                    config_json, seed, status, started_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'running', ?)
                """,
                (
                    run_id,
                    kind,
                    model_kind,
                    dataset_version_id,
                    checkpoint_sha256,
                    _json(config),
                    seed,
                    _now(),
                ),
            )
        return run_id

    def finish_run(self, run_id: str, *, passed: bool, error: str | None = None) -> None:
        with self.connect() as connection:
            cursor = connection.execute(
                """
                UPDATE runs SET status = ?, finished_at = ?, error_text = ?
                WHERE id = ? AND status = 'running'
                """,
                ("passed" if passed else "failed", _now(), error, run_id),
            )
        if cursor.rowcount != 1:
            raise ValueError(f"Run is unknown or already finished: {run_id}")

    def add_metric(
        self,
        *,
        run_id: str,
        name: str,
        value: float,
        split: str | None = None,
        unit: str = "scalar",
        dimensions: JsonMapping | None = None,
    ) -> None:
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO metrics(run_id, split, name, value, unit, dimensions_json, recorded_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (run_id, split, name, value, unit, _json(dimensions or {}), _now()),
            )

    def add_artifact(
        self,
        *,
        run_id: str,
        kind: str,
        path: Path,
        metadata: JsonMapping | None = None,
    ) -> str:
        data = path.read_bytes()
        artifact_id = _id("artifact")
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO artifacts(
                    id, run_id, kind, path, sha256, size_bytes, metadata_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    artifact_id,
                    run_id,
                    kind,
                    str(path.resolve()),
                    hashlib.sha256(data).hexdigest(),
                    len(data),
                    _json(metadata or {}),
                    _now(),
                ),
            )
        return artifact_id

    def record_inference(
        self,
        *,
        run_id: str | None,
        episode_id: str | None,
        model_kind: str,
        mode: str,
        effort: str,
        prompt_text: str,
        selected_answer: int | None,
        is_correct: bool | None,
        elapsed_ms: float,
        total_generated_tokens: int,
        total_forward_passes: int,
        verifier_passes: int,
        metadata: JsonMapping | None = None,
        trace_id: str | None = None,
    ) -> str:
        identifier = trace_id or _id("trace")
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO inference_traces(
                    id, run_id, episode_id, model_kind, mode, effort, prompt_text,
                    selected_answer, is_correct, elapsed_ms, total_generated_tokens,
                    total_forward_passes, verifier_passes, metadata_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    identifier,
                    run_id,
                    episode_id,
                    model_kind,
                    mode,
                    effort,
                    prompt_text,
                    selected_answer,
                    None if is_correct is None else int(is_correct),
                    elapsed_ms,
                    total_generated_tokens,
                    total_forward_passes,
                    verifier_passes,
                    _json(metadata or {}),
                    _now(),
                ),
            )
        return identifier

    def record_candidates(self, trace_id: str, candidates: Iterable[JsonMapping]) -> list[str]:
        rows = []
        candidate_ids: list[str] = []
        for rank, candidate in enumerate(candidates):
            candidate_id = str(candidate.get("id") or _id("candidate"))
            candidate_ids.append(candidate_id)
            rows.append(
                (
                    candidate_id,
                    trace_id,
                    rank,
                    str(candidate["output_text"]),
                    candidate.get("final_answer"),
                    float(candidate.get("normalized_logprob", 0.0)),
                    int(bool(candidate.get("protocol_valid", False))),
                    float(candidate.get("verifier_score", 0.0)),
                    int(candidate.get("generated_tokens", 0)),
                    int(candidate.get("forward_passes", 0)),
                    int(bool(candidate.get("selected", False))),
                    _json(candidate.get("metadata", {})),
                )
            )
        with self.connect() as connection:
            connection.executemany(
                """
                INSERT INTO generation_candidates(
                    id, trace_id, candidate_rank, output_text, final_answer,
                    normalized_logprob, protocol_valid, verifier_score,
                    generated_tokens, forward_passes, selected, metadata_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                rows,
            )
        return candidate_ids

    def record_token_steps(
        self,
        *,
        candidate_id: str,
        steps: Iterable[JsonMapping],
        attention: Any = None,
        routing: Any = None,
    ) -> None:
        rows = []
        materialized = list(steps)
        for index, step in enumerate(materialized):
            rows.append(
                (
                    candidate_id,
                    int(step.get("position", index)),
                    int(step["token_id"]),
                    str(step["token_text"]),
                    float(step.get("logprob", 0.0)),
                    _json(step.get("top_probabilities", [])),
                    _json(attention) if index == len(materialized) - 1 and attention else None,
                    _json(routing) if index == len(materialized) - 1 and routing else None,
                    float(step.get("elapsed_ms", 0.0)),
                )
            )
        with self.connect() as connection:
            connection.executemany(
                """
                INSERT INTO token_steps(
                    candidate_id, position, token_id, token_text, logprob,
                    top_probabilities_json, attention_json, routing_json, elapsed_ms
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                rows,
            )

    def record_moe_routing(
        self,
        *,
        trace_id: str,
        candidate_id: str,
        summaries: Iterable[JsonMapping],
    ) -> None:
        rows = [
            (
                trace_id,
                candidate_id,
                int(summary["layer_index"]),
                int(summary["expert_index"]),
                int(summary["token_count"]),
                float(summary["mean_gate_probability"]),
            )
            for summary in summaries
        ]
        with self.connect() as connection:
            connection.executemany(
                """
                INSERT INTO moe_routing_summaries(
                    trace_id, candidate_id, layer_index, expert_index,
                    token_count, mean_gate_probability
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                rows,
            )

    def record_retrieval(
        self,
        *,
        trace_id: str | None,
        world_id: str | None,
        method: str,
        query_text: str,
        elapsed_ms: float,
        hits: Sequence[RetrievalHit],
        top_k: int,
    ) -> str:
        event_id = _id("retrieval")
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO retrieval_events(
                    id, trace_id, world_id, method, query_text, top_k, elapsed_ms, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (event_id, trace_id, world_id, method, query_text, top_k, elapsed_ms, _now()),
            )
            connection.executemany(
                """
                INSERT INTO retrieval_hits(event_id, rank, document_id, score, content_hash)
                VALUES (?, ?, ?, ?, ?)
                """,
                [
                    (event_id, rank, hit.document_id, hit.score, hit.content_hash)
                    for rank, hit in enumerate(hits, start=1)
                ],
            )
        return event_id

    def record_tool_call(
        self,
        *,
        trace_id: str | None,
        candidate_id: str | None,
        call_index: int,
        tool_name: str,
        arguments: JsonMapping,
        result: Any,
        status: str,
        elapsed_ms: float,
        error: str | None = None,
    ) -> str:
        call_id = _id("tool")
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO tool_calls(
                    id, trace_id, candidate_id, call_index, tool_name,
                    arguments_json, result_json, status, error_text, elapsed_ms, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    call_id,
                    trace_id,
                    candidate_id,
                    call_index,
                    tool_name,
                    _json(arguments),
                    None if result is None else _json(result),
                    status,
                    error,
                    elapsed_ms,
                    _now(),
                ),
            )
        return call_id

    def table_counts(self) -> dict[str, int]:
        names = (
            "dataset_versions",
            "worlds",
            "documents",
            "episodes",
            "training_examples",
            "runs",
            "metrics",
            "artifacts",
            "inference_traces",
            "generation_candidates",
            "token_steps",
            "retrieval_events",
            "retrieval_hits",
            "tool_calls",
            "moe_routing_summaries",
        )
        with self.connect() as connection:
            return {
                name: int(connection.execute(f"SELECT count(*) FROM {name}").fetchone()[0])
                for name in names
            }
