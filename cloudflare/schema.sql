-- cloudflare/schema.sql

PRAGMA foreign_keys = ON;

-- Tabla principal de datasets
CREATE TABLE IF NOT EXISTS datasets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL DEFAULT 'csv',
  storage_key TEXT,
  preview_key TEXT,
  parent_dataset_id INTEGER,
  version_name TEXT,
  prep_config_json TEXT,
  row_count INTEGER,
  column_count INTEGER,
  target_column TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_dataset_id) REFERENCES datasets(id)
);

-- Metadatos de columnas por dataset
CREATE TABLE IF NOT EXISTS dataset_columns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset_id INTEGER NOT NULL,
  column_name TEXT NOT NULL,
  data_type TEXT NOT NULL,
  is_target INTEGER DEFAULT 0,
  has_nulls INTEGER DEFAULT 0,
  null_count INTEGER DEFAULT 0,
  unique_count INTEGER DEFAULT 0,
  FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
);

-- Historial de consultas SQL
CREATE TABLE IF NOT EXISTS sql_queries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset_id INTEGER,
  query_name TEXT,
  query_text TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE SET NULL
);

-- Experimentos de entrenamiento
CREATE TABLE IF NOT EXISTS experiments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset_id INTEGER NOT NULL,
  experiment_name TEXT NOT NULL,
  problem_type TEXT NOT NULL,
  target_column TEXT NOT NULL,
  train_size REAL NOT NULL DEFAULT 0.8,
  test_size REAL NOT NULL DEFAULT 0.2,
  random_state INTEGER NOT NULL DEFAULT 42,
  task_type TEXT,
  train_split REAL,
  results_json TEXT,
  hyperparams_json TEXT,
  feature_columns_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
);

-- Corridas por experimento y modelo
CREATE TABLE IF NOT EXISTS model_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  experiment_id INTEGER NOT NULL,
  model_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  started_at TEXT,
  finished_at TEXT,
  duration_ms INTEGER,
  error_message TEXT,
  FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE
);

-- Configuración usada en cada corrida
CREATE TABLE IF NOT EXISTS model_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  params_json TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES model_runs(id) ON DELETE CASCADE
);

-- Métricas guardadas por corrida
CREATE TABLE IF NOT EXISTS metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  FOREIGN KEY (run_id) REFERENCES model_runs(id) ON DELETE CASCADE
);

-- Artifacts generados por corrida
CREATE TABLE IF NOT EXISTS artifacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  artifact_type TEXT NOT NULL,
  artifact_key TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id) REFERENCES model_runs(id) ON DELETE CASCADE
);

-- Preparaciones / versiones procesadas de datasets
CREATE TABLE IF NOT EXISTS dataset_preparations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset_id INTEGER NOT NULL,
  version_name TEXT NOT NULL,
  source_table TEXT NOT NULL,
  prepared_table TEXT NOT NULL,
  target_column TEXT NOT NULL,
  selected_features_json TEXT NOT NULL,
  rename_map_json TEXT,
  derived_columns_json TEXT,
  prep_config_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
);

-- Selección de features por dataset / preparación
CREATE TABLE IF NOT EXISTS feature_selections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset_id INTEGER NOT NULL,
  preparation_id INTEGER,
  target_column TEXT NOT NULL,
  selected_features_json TEXT NOT NULL,
  dropped_features_json TEXT,
  task_type TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE,
  FOREIGN KEY (preparation_id) REFERENCES dataset_preparations(id) ON DELETE SET NULL
);

-- Opcional: historial de transformaciones del dataset
CREATE TABLE IF NOT EXISTS dataset_transformations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset_id INTEGER NOT NULL,
  preparation_id INTEGER,
  transformation_type TEXT NOT NULL,
  transformation_json TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE,
  FOREIGN KEY (preparation_id) REFERENCES dataset_preparations(id) ON DELETE SET NULL
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_dataset_columns_dataset_id
  ON dataset_columns(dataset_id);

CREATE INDEX IF NOT EXISTS idx_sql_queries_dataset_id
  ON sql_queries(dataset_id);

CREATE INDEX IF NOT EXISTS idx_experiments_dataset_id
  ON experiments(dataset_id);

CREATE INDEX IF NOT EXISTS idx_model_runs_experiment_id
  ON model_runs(experiment_id);

CREATE INDEX IF NOT EXISTS idx_model_configs_run_id
  ON model_configs(run_id);

CREATE INDEX IF NOT EXISTS idx_metrics_run_id
  ON metrics(run_id);

CREATE INDEX IF NOT EXISTS idx_artifacts_run_id
  ON artifacts(run_id);

CREATE INDEX IF NOT EXISTS idx_dataset_preparations_dataset_id
  ON dataset_preparations(dataset_id);

CREATE INDEX IF NOT EXISTS idx_feature_selections_dataset_id
  ON feature_selections(dataset_id);

CREATE INDEX IF NOT EXISTS idx_dataset_transformations_dataset_id
  ON dataset_transformations(dataset_id);