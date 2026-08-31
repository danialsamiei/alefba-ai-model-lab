from __future__ import annotations

import json
from pathlib import Path

from digit_lm.db import Database
from digit_lm.lab import _snapshot_previous_lab_state


def test_reset_snapshot_never_moves_the_active_release(tmp_path: Path) -> None:
    database = Database(tmp_path / "lab.sqlite3")
    database.initialize()
    artifacts = tmp_path / "artifacts"
    data = tmp_path / "data"
    (artifacts / "runs" / "old-run").mkdir(parents=True)
    (artifacts / "runs" / "old-run" / "model.safetensors").write_bytes(b"weights")
    (artifacts / "latest.json").write_text('{"canonical":"old"}\n', encoding="utf-8")
    (data / "generated").mkdir(parents=True)
    (data / "generated" / "old.jsonl").write_text("{}\n", encoding="utf-8")

    snapshot = _snapshot_previous_lab_state(
        database=database, data_root=data, artifacts_root=artifacts
    )

    assert snapshot is not None
    assert database.path.exists()
    assert (artifacts / "latest.json").read_text(encoding="utf-8") == '{"canonical":"old"}\n'
    assert (artifacts / "runs" / "old-run" / "model.safetensors").read_bytes() == b"weights"
    manifest = json.loads((snapshot / "archive-manifest.json").read_text(encoding="utf-8"))
    assert manifest["active_release_was_moved"] is False
    assert manifest["files"]
