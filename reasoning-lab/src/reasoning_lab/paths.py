from __future__ import annotations

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = PROJECT_ROOT / "configs" / "lab.toml"
DATA_ROOT = PROJECT_ROOT / "data"
GENERATED_DATA_ROOT = DATA_ROOT / "generated"
MANIFEST_ROOT = DATA_ROOT / "manifests"
ARTIFACTS_ROOT = PROJECT_ROOT / "artifacts"
CHECKPOINTS_ROOT = ARTIFACTS_ROOT / "checkpoints"
REPORTS_ROOT = ARTIFACTS_ROOT / "reports"
CHECKPOINT_REGISTRY_PATH = CHECKPOINTS_ROOT / "registry.json"
LATEST_EVALUATION_PATH = REPORTS_ROOT / "latest-evaluation.json"
DATABASE_PATH = PROJECT_ROOT / "reasoning_lab.sqlite3"
