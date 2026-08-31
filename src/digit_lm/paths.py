from __future__ import annotations

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG_PATH = PROJECT_ROOT / "configs" / "lab.toml"
DEFAULT_DATABASE_PATH = PROJECT_ROOT / "lab.sqlite3"
DEFAULT_DATA_ROOT = PROJECT_ROOT / "data"
DEFAULT_ARTIFACTS_ROOT = PROJECT_ROOT / "artifacts"
