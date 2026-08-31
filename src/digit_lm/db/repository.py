from __future__ import annotations

import json
import sqlite3
import uuid
from collections.abc import Iterable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from digit_lm.hashing import canonical_json, sha256_file, sha256_text


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


class Database:
    """Small explicit SQL repository; model inference never reads training rows."""

    def __init__(self, path: Path) -> None:
        self.path = path.resolve()
        self.schema_path = Path(__file__).with_name("schema.sql")

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=5.0)
        connection.row_factory = sqlite3.Row
        mode_row = connection.execute("PRAGMA journal_mode = DELETE").fetchone()
        mode = str(mode_row[0]).lower() if mode_row is not None else "unknown"
        if mode != "delete":
            connection.close()
            raise RuntimeError(f"SQLITE_JOURNAL_MODE_MUST_BE_DELETE_NOT_{mode.upper()}")
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA busy_timeout = 5000")
        return connection

    def initialize(self, *, reset: bool = False) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if reset and any(path.exists() for path in self._database_files()):
            stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
            backup = (
                self.path.parent / ".digit-lm-reset-backups" / f"{stamp}-{uuid.uuid4().hex[:8]}"
            )
            self.archive_to(backup)
        schema = self.schema_path.read_text(encoding="utf-8")
        with self.connect() as connection:
            connection.executescript(schema)

    def _database_files(self) -> list[Path]:
        return [
            self.path,
            Path(f"{self.path}-journal"),
            Path(f"{self.path}-wal"),
            Path(f"{self.path}-shm"),
        ]

    def archive_to(self, directory: Path) -> list[dict[str, str]]:
        """Move an explicitly selected database and sidecars to a recoverable archive."""

        moved: list[dict[str, str]] = []
        for source in self._database_files():
            if not source.exists():
                continue
            directory.mkdir(parents=True, exist_ok=True)
            destination = directory / source.name
            if destination.exists():
                raise FileExistsError(f"RESET_ARCHIVE_TARGET_EXISTS: {destination}")
            source.replace(destination)
            moved.append({"source": str(source), "archive": str(destination)})
        return moved

    def snapshot_to(self, directory: Path) -> list[dict[str, Any]]:
        """Create a consistent, non-destructive SQLite backup of the active ledger."""

        if not self.path.exists():
            return []
        directory.mkdir(parents=True, exist_ok=True)
        destination = directory / self.path.name
        if destination.exists():
            raise FileExistsError(f"SNAPSHOT_TARGET_EXISTS: {destination}")
        with self.connect() as source, sqlite3.connect(destination) as target:
            source.backup(target)
        return [
            {
                "source": str(self.path),
                "snapshot": str(destination.resolve()),
                "sha256": sha256_file(destination),
                "size_bytes": destination.stat().st_size,
            }
        ]

    def sqlite_version(self) -> str:
        with self.connect() as connection:
            row = connection.execute("SELECT sqlite_version() AS version").fetchone()
        assert row is not None
        return str(row["version"])

    def register_dataset(
        self,
        dataset: dict[str, Any],
        examples: Iterable[dict[str, Any]],
    ) -> None:
        rows = list(examples)
        with self.connect() as connection:
            existing = connection.execute(
                "SELECT manifest_sha256, row_count FROM datasets WHERE dataset_id = ?",
                (dataset["dataset_id"],),
            ).fetchone()
            if existing is not None:
                if (
                    existing["manifest_sha256"] != dataset["manifest_sha256"]
                    or existing["row_count"] != dataset["row_count"]
                ):
                    raise ValueError(f"IMMUTABLE_DATASET_MISMATCH: {dataset['dataset_id']}")
                self._verify_dataset_connection(
                    connection,
                    dataset_id=str(dataset["dataset_id"]),
                    expected_rows=rows,
                )
                return
            connection.execute(
                """
                INSERT INTO datasets(
                    dataset_id, name, version, purpose, generator_config_json,
                    manifest_sha256, row_count, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    dataset["dataset_id"],
                    dataset["name"],
                    dataset["version"],
                    dataset["purpose"],
                    canonical_json(dataset["generator_config"]),
                    dataset["manifest_sha256"],
                    dataset["row_count"],
                    utc_now(),
                ),
            )
            connection.executemany(
                """
                INSERT INTO examples(
                    example_id, dataset_id, split, objective, input_text, target_text,
                    input_ids_json, target_ids_json, metadata_json, row_sha256
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        row["example_id"],
                        dataset["dataset_id"],
                        row["split"],
                        row["objective"],
                        row["input_text"],
                        row["target_text"],
                        canonical_json(row["input_ids"]),
                        canonical_json(row["target_ids"]),
                        canonical_json(row["metadata"]),
                        row["row_sha256"],
                    )
                    for row in rows
                ],
            )
            self._verify_dataset_connection(
                connection,
                dataset_id=str(dataset["dataset_id"]),
                expected_rows=rows,
            )

    @staticmethod
    def _decoded_example(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "example_id": row["example_id"],
            "split": row["split"],
            "objective": row["objective"],
            "input_text": row["input_text"],
            "target_text": row["target_text"],
            "input_ids": json.loads(row["input_ids_json"]),
            "target_ids": json.loads(row["target_ids_json"]),
            "metadata": json.loads(row["metadata_json"]),
            "row_sha256": row["row_sha256"],
        }

    def _verify_dataset_connection(
        self,
        connection: sqlite3.Connection,
        *,
        dataset_id: str,
        expected_rows: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        dataset_row = connection.execute(
            "SELECT * FROM datasets WHERE dataset_id = ?", (dataset_id,)
        ).fetchone()
        if dataset_row is None:
            raise KeyError(f"DATASET_NOT_FOUND: {dataset_id}")
        stored_rows = connection.execute(
            "SELECT * FROM examples WHERE dataset_id = ? ORDER BY example_id", (dataset_id,)
        ).fetchall()
        if len(stored_rows) != int(dataset_row["row_count"]):
            raise ValueError(f"DATASET_INTEGRITY_ROW_COUNT_MISMATCH: {dataset_id}")

        reconstructed: list[dict[str, Any]] = []
        for stored in stored_rows:
            row = self._decoded_example(stored)
            payload = {
                key: row[key]
                for key in (
                    "split",
                    "objective",
                    "input_text",
                    "target_text",
                    "input_ids",
                    "target_ids",
                    "metadata",
                )
            }
            actual_row_sha = sha256_text(canonical_json(payload))
            if actual_row_sha != row["row_sha256"]:
                raise ValueError(
                    f"DATASET_INTEGRITY_ROW_SHA256_MISMATCH: {dataset_id}:{row['example_id']}"
                )
            reconstructed.append(row)

        if expected_rows is not None:
            expected = sorted(expected_rows, key=lambda item: str(item["example_id"]))
            if canonical_json(reconstructed) != canonical_json(expected):
                raise ValueError(f"IMMUTABLE_DATASET_CONTENT_MISMATCH: {dataset_id}")

        manifest_core = {
            "name": dataset_row["name"],
            "version": dataset_row["version"],
            "purpose": dataset_row["purpose"],
            "generator_config": json.loads(dataset_row["generator_config_json"]),
            "rows": reconstructed,
        }
        actual_manifest_sha = sha256_text(canonical_json(manifest_core))
        if actual_manifest_sha != dataset_row["manifest_sha256"]:
            raise ValueError(f"DATASET_INTEGRITY_MANIFEST_MISMATCH: {dataset_id}")
        return {
            "dataset_id": dataset_id,
            "row_count": len(reconstructed),
            "manifest_sha256": actual_manifest_sha,
        }

    def verify_dataset(self, name: str) -> dict[str, Any]:
        with self.connect() as connection:
            row = connection.execute(
                "SELECT dataset_id FROM datasets WHERE name = ?", (name,)
            ).fetchone()
            if row is None:
                raise KeyError(f"DATASET_NOT_FOUND: {name}")
            return self._verify_dataset_connection(connection, dataset_id=str(row["dataset_id"]))

    def dataset_by_name(self, name: str) -> dict[str, Any]:
        with self.connect() as connection:
            row = connection.execute("SELECT * FROM datasets WHERE name = ?", (name,)).fetchone()
        if row is None:
            raise KeyError(f"DATASET_NOT_FOUND: {name}")
        return dict(row)

    def load_examples(self, dataset_name: str, split: str | None = None) -> list[dict[str, Any]]:
        query = """
            SELECT e.* FROM examples e
            JOIN datasets d ON d.dataset_id = e.dataset_id
            WHERE d.name = ?
        """
        parameters: list[Any] = [dataset_name]
        if split is not None:
            query += " AND e.split = ?"
            parameters.append(split)
        query += " ORDER BY e.example_id"
        with self.connect() as connection:
            rows = connection.execute(query, parameters).fetchall()
        decoded: list[dict[str, Any]] = []
        for row in rows:
            item = dict(row)
            for key in ("input_ids_json", "target_ids_json", "metadata_json"):
                item[key.removesuffix("_json")] = json.loads(item.pop(key))
            decoded.append(item)
        return decoded

    def create_run(self, record: dict[str, Any]) -> None:
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO runs(
                    run_id, stage, status, parent_run_id, dataset_id, seed, device,
                    model_config_json, train_config_json, environment_json,
                    parameter_count, started_at
                ) VALUES (?, ?, 'running', ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record["run_id"],
                    record["stage"],
                    record.get("parent_run_id"),
                    record["dataset_id"],
                    record["seed"],
                    record["device"],
                    canonical_json(record["model_config"]),
                    canonical_json(record["train_config"]),
                    canonical_json(record["environment"]),
                    record["parameter_count"],
                    utc_now(),
                ),
            )

    def finish_run(
        self,
        run_id: str,
        *,
        status: str,
        best_loss: float | None = None,
        checkpoint_path: str | None = None,
        checkpoint_sha256: str | None = None,
        tensor_sha256: str | None = None,
        error_text: str | None = None,
    ) -> None:
        with self.connect() as connection:
            connection.execute(
                """
                UPDATE runs SET status = ?, ended_at = ?, best_loss = ?, checkpoint_path = ?,
                    checkpoint_sha256 = ?, tensor_sha256 = ?, error_text = ?
                WHERE run_id = ?
                """,
                (
                    status,
                    utc_now(),
                    best_loss,
                    checkpoint_path,
                    checkpoint_sha256,
                    tensor_sha256,
                    error_text,
                    run_id,
                ),
            )

    def complete_run(
        self,
        run_id: str,
        *,
        best_loss: float,
        checkpoint_path: str,
        checkpoint_sha256: str,
        tensor_sha256: str,
        artifacts: list[dict[str, Any]],
    ) -> None:
        """Atomically record every artifact and only then make a run completed."""

        with self.connect() as connection:
            connection.executemany(
                """
                INSERT INTO artifacts(run_id, kind, path, sha256, size_bytes, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        run_id,
                        artifact["kind"],
                        artifact["path"],
                        artifact["sha256"],
                        artifact["size_bytes"],
                        utc_now(),
                    )
                    for artifact in artifacts
                ],
            )
            cursor = connection.execute(
                """
                UPDATE runs SET status = 'completed', ended_at = ?, best_loss = ?,
                    checkpoint_path = ?, checkpoint_sha256 = ?, tensor_sha256 = ?,
                    error_text = NULL
                WHERE run_id = ? AND status = 'running'
                """,
                (
                    utc_now(),
                    best_loss,
                    checkpoint_path,
                    checkpoint_sha256,
                    tensor_sha256,
                    run_id,
                ),
            )
            if cursor.rowcount != 1:
                raise RuntimeError(f"RUN_COMPLETION_STATE_MISMATCH: {run_id}")

    def record_metric(self, run_id: str, metric: dict[str, Any]) -> None:
        with self.connect() as connection:
            connection.execute(
                """
                INSERT OR REPLACE INTO metrics(
                    run_id, step, split, loss, token_accuracy, perplexity,
                    learning_rate, gradient_norm, recorded_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    metric["step"],
                    metric["split"],
                    metric["loss"],
                    metric["token_accuracy"],
                    metric["perplexity"],
                    metric["learning_rate"],
                    metric.get("gradient_norm"),
                    utc_now(),
                ),
            )

    def record_artifact(self, run_id: str, artifact: dict[str, Any]) -> None:
        with self.connect() as connection:
            connection.execute(
                """
                INSERT OR REPLACE INTO artifacts(run_id, kind, path, sha256, size_bytes, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    artifact["kind"],
                    artifact["path"],
                    artifact["sha256"],
                    artifact["size_bytes"],
                    utc_now(),
                ),
            )

    def record_evaluation(self, run_id: str, evaluation: dict[str, Any]) -> None:
        with self.connect() as connection:
            connection.execute(
                """
                INSERT OR REPLACE INTO evaluations(
                    run_id, experiment, input_text, expected_text, predicted_text,
                    correct, supported, logits_json, probabilities_json, entropy,
                    exposure_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    evaluation["experiment"],
                    evaluation["input"],
                    evaluation["expected"],
                    evaluation["predicted"],
                    int(evaluation["correct"]),
                    int(evaluation["supported"]),
                    canonical_json(evaluation["logits"]),
                    canonical_json(evaluation["probabilities"]),
                    evaluation["entropy"],
                    canonical_json(evaluation["exposure"]),
                    utc_now(),
                ),
            )

    def log_inference(
        self,
        *,
        run_id: str | None,
        raw_input: str,
        accepted: bool,
        duration_ms: float,
        rejection_code: str | None = None,
        predicted_text: str | None = None,
    ) -> None:
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO inference_requests(
                    run_id, raw_input, accepted, rejection_code, predicted_text,
                    duration_ms, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    raw_input,
                    int(accepted),
                    rejection_code,
                    predicted_text,
                    duration_ms,
                    utc_now(),
                ),
            )

    def run(self, run_id: str) -> dict[str, Any]:
        with self.connect() as connection:
            row = connection.execute("SELECT * FROM runs WHERE run_id = ?", (run_id,)).fetchone()
        if row is None:
            raise KeyError(f"RUN_NOT_FOUND: {run_id}")
        return dict(row)

    def metrics_for_run(self, run_id: str) -> list[dict[str, Any]]:
        with self.connect() as connection:
            rows = connection.execute(
                "SELECT * FROM metrics WHERE run_id = ? ORDER BY step, split", (run_id,)
            ).fetchall()
        return [dict(row) for row in rows]

    def verify_run_artifacts(self, run_id: str) -> dict[str, Any]:
        with self.connect() as connection:
            run = connection.execute(
                "SELECT status FROM runs WHERE run_id = ?", (run_id,)
            ).fetchone()
            rows = connection.execute(
                "SELECT kind, path, sha256, size_bytes FROM artifacts WHERE run_id = ?",
                (run_id,),
            ).fetchall()
        if run is None:
            raise KeyError(f"RUN_NOT_FOUND: {run_id}")
        required = {"weights", "metadata", "metrics", "training_state", "tokenizer"}
        actual = {str(row["kind"]) for row in rows}
        if str(run["status"]) != "completed" or actual != required:
            raise ValueError(f"RUN_ARTIFACT_LEDGER_INCOMPLETE: {run_id}")
        for row in rows:
            path = Path(str(row["path"]))
            if (
                not path.is_file()
                or path.stat().st_size != int(row["size_bytes"])
                or sha256_file(path) != str(row["sha256"])
            ):
                raise ValueError(f"RUN_ARTIFACT_INTEGRITY_MISMATCH: {run_id}:{row['kind']}")
        return {"run_id": run_id, "artifact_count": len(rows), "verified": True}

    def summary(self) -> dict[str, Any]:
        with self.connect() as connection:
            journal_row = connection.execute("PRAGMA journal_mode").fetchone()
            dataset_rows = connection.execute(
                "SELECT name, purpose, row_count, manifest_sha256 FROM datasets ORDER BY name"
            ).fetchall()
            run_rows = connection.execute(
                """
                SELECT run_id, stage, status, parent_run_id, dataset_id, parameter_count,
                       best_loss, checkpoint_sha256, tensor_sha256, started_at, ended_at
                FROM runs ORDER BY started_at
                """
            ).fetchall()
            evaluation_rows = connection.execute(
                """
                SELECT e.run_id, e.experiment, COUNT(*) AS total, SUM(e.correct) AS correct,
                       SUM(e.supported) AS supported, r.started_at AS run_started_at
                FROM evaluations e JOIN runs r ON r.run_id = e.run_id
                GROUP BY e.run_id, e.experiment
                ORDER BY r.started_at, e.experiment
                """
            ).fetchall()
            request_count = connection.execute(
                "SELECT COUNT(*) AS count FROM inference_requests"
            ).fetchone()
        return {
            "sqlite_version": self.sqlite_version(),
            "journal_mode": str(journal_row[0]).lower() if journal_row is not None else "unknown",
            "datasets": [dict(row) for row in dataset_rows],
            "runs": [dict(row) for row in run_rows],
            "evaluations": [dict(row) for row in evaluation_rows],
            "inference_request_count": int(request_count["count"] if request_count else 0),
        }
