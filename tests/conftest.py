from __future__ import annotations

from pathlib import Path

import pytest

from digit_lm.config import ModelConfig, TrainConfig
from digit_lm.data import build_all_datasets
from digit_lm.db import Database
from digit_lm.training import TrainResult, train_stage


@pytest.fixture(scope="session")
def trained_lab(tmp_path_factory: pytest.TempPathFactory) -> tuple[TrainResult, Database]:
    root = tmp_path_factory.mktemp("trained-lab")
    database = Database(root / "lab.sqlite3")
    database.initialize()
    model_config = ModelConfig(
        context_length=8,
        d_model=16,
        n_heads=2,
        n_layers=1,
        d_ff=32,
        dropout=0.0,
    )
    build_all_datasets(database, root / "data", context_length=model_config.context_length)
    result = train_stage(
        database=database,
        dataset_name="sft_successor_full_v1",
        stage="test-sft",
        model_config=model_config,
        train_config=TrainConfig(
            steps=300,
            batch_size=10,
            learning_rate=0.01,
            min_learning_rate=0.0001,
            warmup_steps=10,
            eval_interval=50,
            weight_decay=0.0,
            gradient_clip=1.0,
        ),
        seed=20260830,
        artifacts_root=root / "artifacts",
    )
    return result, database


@pytest.fixture()
def empty_database(tmp_path: Path) -> Database:
    database = Database(tmp_path / "lab.sqlite3")
    database.initialize()
    return database
