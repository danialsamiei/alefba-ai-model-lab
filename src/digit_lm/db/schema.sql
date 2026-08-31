PRAGMA journal_mode = DELETE;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS datasets (
    dataset_id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    version INTEGER NOT NULL,
    purpose TEXT NOT NULL,
    generator_config_json TEXT NOT NULL,
    manifest_sha256 TEXT NOT NULL,
    row_count INTEGER NOT NULL CHECK (row_count >= 0),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS examples (
    example_id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL REFERENCES datasets(dataset_id),
    split TEXT NOT NULL CHECK (split IN ('train', 'validation', 'test', 'probe')),
    objective TEXT NOT NULL CHECK (objective IN ('causal_lm', 'successor_sft')),
    input_text TEXT NOT NULL,
    target_text TEXT NOT NULL,
    input_ids_json TEXT NOT NULL,
    target_ids_json TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    row_sha256 TEXT NOT NULL,
    UNIQUE (dataset_id, row_sha256)
);

CREATE INDEX IF NOT EXISTS idx_examples_dataset_split
    ON examples(dataset_id, split);

CREATE TABLE IF NOT EXISTS runs (
    run_id TEXT PRIMARY KEY,
    stage TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
    parent_run_id TEXT REFERENCES runs(run_id),
    dataset_id TEXT NOT NULL REFERENCES datasets(dataset_id),
    seed INTEGER NOT NULL,
    device TEXT NOT NULL,
    model_config_json TEXT NOT NULL,
    train_config_json TEXT NOT NULL,
    environment_json TEXT NOT NULL,
    parameter_count INTEGER NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    best_loss REAL,
    checkpoint_path TEXT,
    checkpoint_sha256 TEXT,
    tensor_sha256 TEXT,
    error_text TEXT
);

CREATE TABLE IF NOT EXISTS metrics (
    metric_id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL REFERENCES runs(run_id),
    step INTEGER NOT NULL,
    split TEXT NOT NULL,
    loss REAL NOT NULL,
    token_accuracy REAL NOT NULL,
    perplexity REAL NOT NULL,
    learning_rate REAL NOT NULL,
    gradient_norm REAL,
    recorded_at TEXT NOT NULL,
    UNIQUE (run_id, step, split)
);

CREATE TABLE IF NOT EXISTS artifacts (
    artifact_id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL REFERENCES runs(run_id),
    kind TEXT NOT NULL,
    path TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (run_id, kind, path)
);

CREATE TABLE IF NOT EXISTS evaluations (
    evaluation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL REFERENCES runs(run_id),
    experiment TEXT NOT NULL,
    input_text TEXT NOT NULL,
    expected_text TEXT NOT NULL,
    predicted_text TEXT NOT NULL,
    correct INTEGER NOT NULL CHECK (correct IN (0, 1)),
    supported INTEGER NOT NULL CHECK (supported IN (0, 1)),
    logits_json TEXT NOT NULL,
    probabilities_json TEXT NOT NULL,
    entropy REAL NOT NULL,
    exposure_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (run_id, experiment, input_text)
);

CREATE TABLE IF NOT EXISTS inference_requests (
    request_id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT,
    raw_input TEXT NOT NULL,
    accepted INTEGER NOT NULL CHECK (accepted IN (0, 1)),
    rejection_code TEXT,
    predicted_text TEXT,
    duration_ms REAL NOT NULL,
    created_at TEXT NOT NULL
);

INSERT OR IGNORE INTO schema_migrations(version, applied_at)
VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
