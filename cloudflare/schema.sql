CREATE TABLE IF NOT EXISTS datasets (
  source_type TEXT NOT NULL,
  storage_key TEXT,
  preview_key TEXT,
  row_count INTEGER,
  column_count INTEGER,
  target_column TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dataset_columns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset_id INTEGER NOT NULL,
  column_name TEXT NOT NULL,
  data_type TEXT NOT NULL,
  is_target INTEGER DEFAULT 0,
  has_nulls INTEGER DEFAULT 0,
  null_count INTEGER DEFAULT 0,
  unique_count INTEGER DEFAULT 0,
  FOREIGN KEY (dataset_id) REFERENCES datasets(id)
);

CREATE TABLE IF NOT EXISTS sql_queries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset_id INTEGER,
  query_name TEXT,
  query_text TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dataset_id) REFERENCES datasets(id)
);

CREATE TABLE IF NOT EXISTS experiments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset_id INTEGER NOT NULL,
  experiment_name TEXT NOT NULL,
  problem_type TEXT NOT NULL,
  target_column TEXT NOT NULL,
  train_size REAL NOT NULL DEFAULT 0.8,
  test_size REAL NOT NULL DEFAULT 0.2,
  random_state INTEGER NOT NULL DEFAULT 42,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dataset_id) REFERENCES datasets(id)
);

CREATE TABLE IF NOT EXISTS model_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  experiment_id INTEGER NOT NULL,
  model_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  started_at TEXT,
  finished_at TEXT,
  duration_ms INTEGER,
  error_message TEXT,
  FOREIGN KEY (experiment_id) REFERENCES experiments(id)
);

CREATE TABLE IF NOT EXISTS model_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  params_json TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES model_runs(id)
);

CREATE TABLE IF NOT EXISTS metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  FOREIGN KEY (run_id) REFERENCES model_runs(id)
);

CREATE TABLE IF NOT EXISTS artifacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  artifact_type TEXT NOT NULL,
  artifact_key TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id) REFERENCES model_runs(id)
);
