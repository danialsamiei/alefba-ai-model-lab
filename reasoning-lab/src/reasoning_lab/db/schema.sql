PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS dataset_versions (
    id TEXT PRIMARY KEY,
    dataset_hash TEXT NOT NULL UNIQUE,
    config_json TEXT NOT NULL,
    manifest_path TEXT,
    created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS worlds (
    id TEXT PRIMARY KEY,
    dataset_version_id TEXT NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
    split TEXT NOT NULL CHECK (split IN ('train', 'validation', 'iid_test', 'depth_ood', 'rag_holdout')),
    facts_json TEXT NOT NULL,
    facts_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (dataset_version_id, facts_hash)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_worlds_dataset_split
ON worlds(dataset_version_id, split, id);

CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    variable TEXT NOT NULL CHECK (length(variable) = 1 AND variable BETWEEN 'A' AND 'H'),
    value INTEGER NOT NULL CHECK (value BETWEEN 0 AND 9),
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    source_uri TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    UNIQUE (world_id, variable)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_documents_world_variable
ON documents(world_id, variable);

CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
    document_id UNINDEXED,
    world_id UNINDEXED,
    content,
    tokenize = 'unicode61'
);

CREATE TRIGGER IF NOT EXISTS documents_fts_insert
AFTER INSERT ON documents BEGIN
    INSERT INTO documents_fts(document_id, world_id, content)
    VALUES (new.id, new.world_id, new.content);
END;

CREATE TRIGGER IF NOT EXISTS documents_fts_delete
AFTER DELETE ON documents BEGIN
    DELETE FROM documents_fts WHERE document_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS documents_fts_update
AFTER UPDATE OF content, world_id ON documents BEGIN
    DELETE FROM documents_fts WHERE document_id = old.id;
    INSERT INTO documents_fts(document_id, world_id, content)
    VALUES (new.id, new.world_id, new.content);
END;

CREATE TABLE IF NOT EXISTS episodes (
    id TEXT PRIMARY KEY,
    dataset_version_id TEXT NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
    world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    split TEXT NOT NULL CHECK (split IN ('train', 'validation', 'iid_test', 'depth_ood', 'rag_holdout')),
    expression TEXT NOT NULL,
    expression_depth INTEGER NOT NULL CHECK (expression_depth >= 0),
    prompt_text TEXT NOT NULL,
    gold_answer INTEGER NOT NULL CHECK (gold_answer BETWEEN 0 AND 9),
    canonical_trace_json TEXT NOT NULL,
    episode_hash TEXT NOT NULL UNIQUE,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS idx_episodes_dataset_split_depth
ON episodes(dataset_version_id, split, expression_depth, id);

CREATE INDEX IF NOT EXISTS idx_episodes_world
ON episodes(world_id, id);

CREATE TABLE IF NOT EXISTS training_examples (
    id TEXT PRIMARY KEY,
    episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    objective TEXT NOT NULL CHECK (objective IN ('direct', 'scratch', 'tool')),
    token_ids_json TEXT NOT NULL,
    loss_mask_json TEXT NOT NULL,
    sequence_hash TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    UNIQUE (episode_id, objective)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_training_examples_objective
ON training_examples(objective, episode_id);

CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('data', 'train', 'evaluate', 'inference', 'acceptance')),
    model_kind TEXT,
    dataset_version_id TEXT REFERENCES dataset_versions(id) ON DELETE SET NULL,
    checkpoint_sha256 TEXT,
    config_json TEXT NOT NULL,
    seed INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'passed', 'failed', 'cancelled')),
    started_at TEXT NOT NULL,
    finished_at TEXT,
    error_text TEXT
) STRICT;

CREATE INDEX IF NOT EXISTS idx_runs_kind_status_started
ON runs(kind, status, started_at DESC);

CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    split TEXT,
    name TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT NOT NULL DEFAULT 'scalar',
    dimensions_json TEXT NOT NULL DEFAULT '{}',
    recorded_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS idx_metrics_run_name_split
ON metrics(run_id, name, split);

CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    path TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    UNIQUE (run_id, path)
) STRICT;

CREATE TABLE IF NOT EXISTS inference_traces (
    id TEXT PRIMARY KEY,
    run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
    episode_id TEXT REFERENCES episodes(id) ON DELETE SET NULL,
    model_kind TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('model_only', 'rag', 'tools', 'oracle')),
    effort TEXT NOT NULL CHECK (effort IN ('low', 'medium', 'high')),
    prompt_text TEXT NOT NULL,
    selected_answer INTEGER CHECK (selected_answer BETWEEN 0 AND 9),
    is_correct INTEGER CHECK (is_correct IN (0, 1) OR is_correct IS NULL),
    elapsed_ms REAL NOT NULL CHECK (elapsed_ms >= 0),
    total_generated_tokens INTEGER NOT NULL CHECK (total_generated_tokens >= 0),
    total_forward_passes INTEGER NOT NULL CHECK (total_forward_passes >= 0),
    verifier_passes INTEGER NOT NULL CHECK (verifier_passes >= 0),
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS idx_inference_traces_episode_mode_effort
ON inference_traces(episode_id, mode, effort, created_at DESC);

CREATE TABLE IF NOT EXISTS generation_candidates (
    id TEXT PRIMARY KEY,
    trace_id TEXT NOT NULL REFERENCES inference_traces(id) ON DELETE CASCADE,
    candidate_rank INTEGER NOT NULL CHECK (candidate_rank >= 0),
    output_text TEXT NOT NULL,
    final_answer INTEGER CHECK (final_answer BETWEEN 0 AND 9),
    normalized_logprob REAL NOT NULL,
    protocol_valid INTEGER NOT NULL CHECK (protocol_valid IN (0, 1)),
    verifier_score REAL NOT NULL,
    generated_tokens INTEGER NOT NULL CHECK (generated_tokens >= 0),
    forward_passes INTEGER NOT NULL CHECK (forward_passes >= 0),
    selected INTEGER NOT NULL CHECK (selected IN (0, 1)),
    metadata_json TEXT NOT NULL DEFAULT '{}',
    UNIQUE (trace_id, candidate_rank)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_candidates_trace_selected
ON generation_candidates(trace_id, selected DESC, candidate_rank);

CREATE TABLE IF NOT EXISTS token_steps (
    id INTEGER PRIMARY KEY,
    candidate_id TEXT NOT NULL REFERENCES generation_candidates(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position >= 0),
    token_id INTEGER NOT NULL CHECK (token_id >= 0),
    token_text TEXT NOT NULL,
    logprob REAL NOT NULL,
    top_probabilities_json TEXT NOT NULL,
    attention_json TEXT,
    routing_json TEXT,
    elapsed_ms REAL NOT NULL CHECK (elapsed_ms >= 0),
    UNIQUE (candidate_id, position)
) STRICT;

CREATE TABLE IF NOT EXISTS retrieval_events (
    id TEXT PRIMARY KEY,
    trace_id TEXT REFERENCES inference_traces(id) ON DELETE CASCADE,
    world_id TEXT REFERENCES worlds(id) ON DELETE SET NULL,
    method TEXT NOT NULL CHECK (method IN ('none', 'fts5', 'oracle')),
    query_text TEXT NOT NULL,
    top_k INTEGER NOT NULL CHECK (top_k >= 0),
    elapsed_ms REAL NOT NULL CHECK (elapsed_ms >= 0),
    created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS retrieval_hits (
    event_id TEXT NOT NULL REFERENCES retrieval_events(id) ON DELETE CASCADE,
    rank INTEGER NOT NULL CHECK (rank >= 1),
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    score REAL NOT NULL,
    content_hash TEXT NOT NULL,
    PRIMARY KEY (event_id, rank)
) WITHOUT ROWID, STRICT;

CREATE INDEX IF NOT EXISTS idx_retrieval_hits_document
ON retrieval_hits(document_id, event_id);

CREATE TABLE IF NOT EXISTS tool_calls (
    id TEXT PRIMARY KEY,
    trace_id TEXT REFERENCES inference_traces(id) ON DELETE CASCADE,
    candidate_id TEXT REFERENCES generation_candidates(id) ON DELETE CASCADE,
    call_index INTEGER NOT NULL CHECK (call_index >= 0),
    tool_name TEXT NOT NULL CHECK (tool_name IN ('LOOKUP', 'CALC')),
    arguments_json TEXT NOT NULL,
    result_json TEXT,
    status TEXT NOT NULL CHECK (status IN ('ok', 'rejected', 'error', 'budget_exhausted')),
    error_text TEXT,
    elapsed_ms REAL NOT NULL CHECK (elapsed_ms >= 0),
    created_at TEXT NOT NULL,
    UNIQUE (trace_id, candidate_id, call_index)
) STRICT;

CREATE TABLE IF NOT EXISTS moe_routing_summaries (
    trace_id TEXT NOT NULL REFERENCES inference_traces(id) ON DELETE CASCADE,
    candidate_id TEXT NOT NULL REFERENCES generation_candidates(id) ON DELETE CASCADE,
    layer_index INTEGER NOT NULL CHECK (layer_index >= 0),
    expert_index INTEGER NOT NULL CHECK (expert_index >= 0),
    token_count INTEGER NOT NULL CHECK (token_count >= 0),
    mean_gate_probability REAL NOT NULL CHECK (mean_gate_probability BETWEEN 0.0 AND 1.0),
    PRIMARY KEY (candidate_id, layer_index, expert_index)
) WITHOUT ROWID, STRICT;

INSERT OR IGNORE INTO schema_migrations(version, description, applied_at)
VALUES (1, 'initial laboratory schema with FTS5 retrieval and complete telemetry', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
