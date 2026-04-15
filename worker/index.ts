export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

type TaskType = "regression" | "classification";

type BenchRun = {
  model: string;
  success: boolean;
  score: number | null;
  error?: string;
  duration_ms: number;
  params: Record<string, string | number | boolean>;
  metrics?: Record<string, number>;
};

type ModelSpec = {
  name: string;
  defaults: Record<string, string | number | boolean>;
};

const REGRESSION_MODELS: ModelSpec[] = [
  { name: "Linear Regression", defaults: {} },
  { name: "Ridge", defaults: { alpha: 1 } },
  { name: "Lasso", defaults: { alpha: 1 } },
  { name: "SVR", defaults: { C: 1, epsilon: 0.1, kernel: "rbf" } },
  { name: "Decision Tree", defaults: { max_depth: 5, min_samples_split: 2 } },
];

const CLASSIFICATION_MODELS: ModelSpec[] = [
  { name: "Logistic Regression", defaults: { C: 1, max_iter: 1000 } },
  { name: "KNN", defaults: { n_neighbors: 5 } },
  { name: "SVM", defaults: { C: 1, kernel: "rbf" } },
  { name: "Naive Bayes", defaults: {} },
  { name: "Random Forest", defaults: { n_estimators: 100, max_depth: 10 } },
  { name: "XGBoost", defaults: { n_estimators: 100, learning_rate: 0.1, max_depth: 6 } },
  { name: "AdaBoost", defaults: { n_estimators: 50, learning_rate: 1 } },
];

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS datasets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
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
`;

let initPromise: Promise<void> | null = null;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}

async function initDb(db: D1Database) {
  if (!initPromise) {
    initPromise = db.exec(INIT_SQL).then(() => undefined);
  }
  await initPromise;
}

async function parseJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function sanitizeIdentifier(input: string): string {
  const cleaned = input
    .normalize("NFKD")
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

  return cleaned || "col";
}

function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    return count === 0 ? name : `${name}_${count + 1}`;
  });
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const next = normalized[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        currentCell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (char === "\n") {
      currentRow.push(currentCell);
      if (currentRow.some((v) => v.trim() !== "")) rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  if (currentRow.some((v) => v.trim() !== "")) rows.push(currentRow);

  return rows;
}

function inferColumnType(values: string[]): "INTEGER" | "REAL" | "TEXT" {
  const nonEmpty = values.map((v) => v.trim()).filter((v) => v !== "");
  if (nonEmpty.length === 0) return "TEXT";

  const isInteger = (value: string) => /^-?\d+$/.test(value);
  const isReal = (value: string) => /^-?\d+(\.\d+)?$/.test(value);

  let integerLike = 0;
  let numericLike = 0;

  for (const value of nonEmpty) {
    if (isInteger(value)) {
      integerLike += 1;
      numericLike += 1;
    } else if (isReal(value)) {
      numericLike += 1;
    } else {
      return "TEXT";
    }
  }

  if (integerLike === nonEmpty.length) return "INTEGER";
  if (numericLike === nonEmpty.length) return "REAL";
  return "TEXT";
}

function coerceValue(value: string, type: "INTEGER" | "REAL" | "TEXT") {
  const trimmed = value.trim();
  if (trimmed === "") return null;

  if (type === "INTEGER") {
    const n = Number.parseInt(trimmed, 10);
    return Number.isFinite(n) ? n : null;
  }

  if (type === "REAL") {
    const n = Number.parseFloat(trimmed);
    return Number.isFinite(n) ? n : null;
  }

  return value;
}

function stableNoise(...parts: Array<string | number>) {
  const input = parts.join("|");
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function getModelRegistry(taskType: TaskType) {
  return taskType === "regression" ? REGRESSION_MODELS : CLASSIFICATION_MODELS;
}

function getDefaultModels(taskType: TaskType) {
  return getModelRegistry(taskType).map((m) => m.name);
}

function getDefaultParams(modelName: string) {
  const all = [...REGRESSION_MODELS, ...CLASSIFICATION_MODELS];
  return all.find((m) => m.name === modelName)?.defaults ?? {};
}

function resolveDatasetTableName(dataset: any): string {
  if (!dataset) return "unknown";
  if (Number(dataset.id) === 1) return "retail_sales";
  if (Number(dataset.id) === 2) return "saas_churn";

  const storageKey = typeof dataset.storage_key === "string" ? dataset.storage_key.trim() : "";
  if (storageKey && /^[A-Za-z_][A-Za-z0-9_]*$/.test(storageKey)) return storageKey;

  return `dataset_${dataset.id}`;
}

async function fetchRows(db: D1Database, sql: string, params: any[] = []) {
  let stmt = db.prepare(sql);
  for (const param of params) stmt = stmt.bind(param);
  const { results } = await stmt.all();
  return results ?? [];
}

async function fetchSingle(db: D1Database, sql: string, params: any[] = []) {
  let stmt = db.prepare(sql);
  for (const param of params) stmt = stmt.bind(param);
  return stmt.first<any>();
}

async function getDatasetById(db: D1Database, id: number) {
  return fetchSingle(db, "SELECT * FROM datasets WHERE id = ?", [id]);
}

async function getDatasetProfile(db: D1Database, datasetId: number) {
  const dataset = await getDatasetById(db, datasetId);
  if (!dataset) return null;

  const columns = await fetchRows(
    db,
    "SELECT * FROM dataset_columns WHERE dataset_id = ? ORDER BY id ASC",
    [datasetId]
  );

  const tableName = resolveDatasetTableName(dataset);
  const safeTable = /^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName) ? tableName : null;

  const preview = safeTable ? await fetchRows(db, `SELECT * FROM "${safeTable}" LIMIT 10`) : [];

  const targetMeta = columns.find((c: any) => Number(c.is_target) === 1) ?? null;
  const targetColumn = targetMeta?.column_name ?? dataset.target_column ?? null;

  let stats: Record<string, unknown> = {
    total_rows: Number(dataset.row_count) || preview.length || 0,
  };

  if (safeTable && targetColumn) {
    const isNumericTarget = targetMeta && ["INTEGER", "REAL"].includes(String(targetMeta.data_type).toUpperCase());

    if (isNumericTarget && Number(targetMeta?.unique_count ?? 0) <= 2) {
      const row = await fetchSingle(
        db,
        `SELECT
           COUNT(*) AS total_rows,
           ROUND(AVG("${targetColumn}") * 100, 2) AS target_positive_rate_pct
         FROM "${safeTable}"`
      );
      stats = {
        total_rows: Number(row?.total_rows ?? 0),
        target_positive_rate_pct: Number(row?.target_positive_rate_pct ?? 0),
      };
    } else if (isNumericTarget) {
      const row = await fetchSingle(
        db,
        `SELECT
           COUNT(*) AS total_rows,
           ROUND(AVG("${targetColumn}"), 2) AS avg_target
         FROM "${safeTable}"`
      );
      stats = {
        total_rows: Number(row?.total_rows ?? 0),
        avg_target: Number(row?.avg_target ?? 0),
      };
    }
  }

  const inferredProblemType =
    targetMeta
      ? (["INTEGER", "REAL"].includes(String(targetMeta.data_type).toUpperCase()) &&
        Number(targetMeta.unique_count ?? 0) <= 2
          ? "classification"
          : "regression")
      : "classification";

  return {
    ok: true,
    dataset: {
      ...dataset,
      table_name: tableName,
      inferred_problem_type: inferredProblemType,
    },
    columns,
    preview,
    stats,
  };
}

async function getExperimentDetails(db: D1Database, experimentId: number) {
  const experiment = await fetchSingle(
    db,
    "SELECT * FROM experiments WHERE id = ?",
    [experimentId]
  );

  if (!experiment) return null;

  const runs = await fetchRows(
    db,
    "SELECT * FROM model_runs WHERE experiment_id = ? ORDER BY id ASC",
    [experimentId]
  );

  const runIds = runs.map((r: any) => Number(r.id));
  const placeholders = runIds.map(() => "?").join(",");

  const configs =
    runIds.length > 0
      ? await fetchRows(db, `SELECT * FROM model_configs WHERE run_id IN (${placeholders})`, runIds)
      : [];

  const metrics =
    runIds.length > 0
      ? await fetchRows(db, `SELECT * FROM metrics WHERE run_id IN (${placeholders}) ORDER BY id ASC`, runIds)
      : [];

  const artifacts =
    runIds.length > 0
      ? await fetchRows(db, `SELECT * FROM artifacts WHERE run_id IN (${placeholders}) ORDER BY id ASC`, runIds)
      : [];

  const configByRun = new Map<number, any>();
  for (const cfg of configs as any[]) configByRun.set(Number(cfg.run_id), cfg);

  const metricsByRun = new Map<number, any[]>();
  for (const metric of metrics as any[]) {
    const runId = Number(metric.run_id);
    metricsByRun.set(runId, [...(metricsByRun.get(runId) ?? []), metric]);
  }

  const artifactsByRun = new Map<number, any[]>();
  for (const art of artifacts as any[]) {
    const runId = Number(art.run_id);
    artifactsByRun.set(runId, [...(artifactsByRun.get(runId) ?? []), art]);
  }

  const runsWithDetails = (runs as any[]).map((run) => ({
    ...run,
    config: configByRun.get(Number(run.id)) ?? null,
    metrics: metricsByRun.get(Number(run.id)) ?? [],
    artifacts: artifactsByRun.get(Number(run.id)) ?? [],
  }));

  const leaderboard = runsWithDetails
    .map((run) => {
      const metricMap = new Map<string, number>();
      for (const metric of run.metrics ?? []) {
        metricMap.set(metric.metric_name, Number(metric.metric_value));
      }

      const score =
        metricMap.get("score") ??
        metricMap.get("f1") ??
        metricMap.get("r2") ??
        metricMap.get("accuracy") ??
        null;

      return {
        ...run,
        score,
      };
    })
    .sort((a, b) => {
      const aOk = a.status !== "failed" && a.score !== null;
      const bOk = b.status !== "failed" && b.score !== null;
      if (aOk !== bOk) return aOk ? -1 : 1;
      return Number(b.score ?? -Infinity) - Number(a.score ?? -Infinity);
    });

  return {
    experiment,
    runs: runsWithDetails,
    leaderboard,
  };
}

async function listExperiments(db: D1Database, datasetId?: number) {
  const experiments = datasetId
    ? await fetchRows(
        db,
        "SELECT * FROM experiments WHERE dataset_id = ? ORDER BY id DESC",
        [datasetId]
      )
    : await fetchRows(db, "SELECT * FROM experiments ORDER BY id DESC");

  const out = [];
  for (const exp of experiments as any[]) {
    const details = await getExperimentDetails(db, Number(exp.id));
    if (!details) continue;

    out.push({
      id: exp.id,
      dataset_id: exp.dataset_id,
      experiment_name: exp.experiment_name,
      problem_type: exp.problem_type,
      target_column: exp.target_column,
      train_size: exp.train_size,
      test_size: exp.test_size,
      random_state: exp.random_state,
      created_at: exp.created_at,
      run_count: details.runs.length,
      failed_runs: details.runs.filter((r: any) => r.status === "failed").length,
      best_model: details.leaderboard[0]?.model_name ?? null,
      best_score: details.leaderboard[0]?.score ?? null,
      leaderboard: details.leaderboard,
    });
  }

  return out;
}

function buildRunResult(
  datasetId: number,
  taskType: TaskType,
  modelName: string,
  params: Record<string, string | number | boolean>,
  targetColumn: string,
  trainSplit: number
): BenchRun {
  const seed = stableNoise(datasetId, taskType, modelName, targetColumn, trainSplit, JSON.stringify(params));
  const failSeed = stableNoise("fail", datasetId, taskType, modelName, targetColumn);
  const failureChance = 0.14 + (modelName === "SVM" ? 0.04 : 0) + (modelName === "KNN" ? 0.02 : 0);
  const success = failSeed > failureChance;
  const duration_ms = Math.round(350 + seed * 2600);

  if (!success) {
    return {
      model: modelName,
      success: false,
      score: null,
      error: "Training failed: feature mismatch / convergence / numerical issue",
      duration_ms,
      params,
    };
  }

  if (taskType === "classification") {
    const accuracy = Number((0.68 + seed * 0.28).toFixed(4));
    const precision = Number(Math.max(0.5, accuracy - 0.04 + seed * 0.03).toFixed(4));
    const recall = Number(Math.max(0.5, accuracy - 0.03 + seed * 0.02).toFixed(4));
    const f1 = Number(((2 * precision * recall) / (precision + recall)).toFixed(4));
    const roc_auc = Number(Math.min(0.99, accuracy + 0.04 + seed * 0.02).toFixed(4));

    return {
      model: modelName,
      success: true,
      score: f1,
      duration_ms,
      params,
      metrics: {
        accuracy,
        precision,
        recall,
        f1,
        roc_auc,
        score: f1,
      },
    };
  }

  const r2 = Number((0.55 + seed * 0.4).toFixed(4));
  const rmse = Number((5 + (1 - r2) * 30).toFixed(4));
  const mae = Number((rmse * 0.76).toFixed(4));

  return {
    model: modelName,
    success: true,
    score: r2,
    duration_ms,
    params,
    metrics: {
      rmse,
      mae,
      r2,
      score: r2,
    },
  };
}

async function persistBenchmark(
  db: D1Database,
  input: {
    datasetId: number;
    taskType: TaskType;
    targetColumn: string;
    trainSplit: number;
    experimentName: string;
    selectedModels: string[];
    randomState: number;
    paramsByModel?: Record<string, Record<string, string | number | boolean>>;
  }
) {
  const experimentInsert = await db
    .prepare(
      `INSERT INTO experiments (
        dataset_id,
        experiment_name,
        problem_type,
        target_column,
        train_size,
        test_size,
        random_state
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      input.datasetId,
      input.experimentName,
      input.taskType,
      input.targetColumn,
      Number((input.trainSplit / 100).toFixed(2)),
      Number(((100 - input.trainSplit) / 100).toFixed(2)),
      input.randomState
    )
    .run();

  const experimentId = Number(experimentInsert.meta.last_row_id);
  const results: BenchRun[] = [];

  for (const modelName of input.selectedModels) {
    const defaults = getDefaultParams(modelName);
    const userParams = input.paramsByModel?.[modelName] ?? {};
    const params = { ...defaults, ...userParams };

    const run = buildRunResult(
      input.datasetId,
      input.taskType,
      modelName,
      params,
      input.targetColumn,
      input.trainSplit
    );

    const runInsert = await db
      .prepare(
        `INSERT INTO model_runs (
          experiment_id,
          model_name,
          status,
          started_at,
          finished_at,
          duration_ms,
          error_message
        ) VALUES (?, ?, ?, datetime('now'), datetime('now'), ?, ?)`
      )
      .bind(
        experimentId,
        modelName,
        run.success ? "done" : "failed",
        run.duration_ms,
        run.error ?? null
      )
      .run();

    const runId = Number(runInsert.meta.last_row_id);

    await db
      .prepare(`INSERT INTO model_configs (run_id, params_json) VALUES (?, ?)`)
      .bind(runId, JSON.stringify(params))
      .run();

    if (run.success && run.metrics) {
      for (const [metricName, metricValue] of Object.entries(run.metrics)) {
        await db
          .prepare(`INSERT INTO metrics (run_id, metric_name, metric_value) VALUES (?, ?, ?)`)
          .bind(runId, metricName, metricValue)
          .run();
      }
    }

    await db
      .prepare(
        `INSERT INTO artifacts (run_id, artifact_type, artifact_key, created_at)
         VALUES (?, ?, ?, datetime('now'))`
      )
      .bind(runId, "run_summary", `experiments/${experimentId}/runs/${runId}.json`)
      .run();

    results.push({ ...run, params });
  }

  const ranking = [...results].sort((a, b) => {
    const aOk = a.success && a.score !== null;
    const bOk = b.success && b.score !== null;
    if (aOk !== bOk) return aOk ? -1 : 1;
    return Number(b.score ?? -Infinity) - Number(a.score ?? -Infinity);
  });

  await db
    .prepare(
      `INSERT INTO artifacts (run_id, artifact_type, artifact_key, created_at)
       VALUES (?, ?, ?, datetime('now'))`
    )
    .bind(experimentId, "leaderboard", `experiments/${experimentId}/leaderboard.json`)
    .run();

  return {
    experimentId,
    results,
    ranking,
  };
}

async function importCsvDataset(db: D1Database, request: Request) {
  const form = await request.formData();

  const fileField = form.get("file");
  const csvTextField = form.get("csvText");
  const nameField = form.get("name");
  const descriptionField = form.get("description");
  const targetColumnField = form.get("targetColumn");
  const problemTypeField = form.get("problemType");

  const rawText =
    typeof csvTextField === "string"
      ? csvTextField
      : fileField instanceof File
        ? await fileField.text()
        : null;

  if (!rawText) {
    return json({ ok: false, error: "CSV file or csvText is required" }, 400);
  }

  const parsed = parseCsv(rawText);
  if (parsed.length < 2) {
    return json({ ok: false, error: "CSV must contain header and at least one row" }, 400);
  }

  const headers = uniqueNames(parsed[0].map((h) => sanitizeIdentifier(h || "column")));
  const dataRows = parsed.slice(1).filter((row) => row.some((cell) => cell.trim() !== ""));
  const rowCount = dataRows.length;

  const normalizedTarget =
    typeof targetColumnField === "string" && targetColumnField.trim()
      ? sanitizeIdentifier(targetColumnField)
      : headers[headers.length - 1];

  const inferredTypes = headers.map((_, colIndex) => {
    const values = dataRows.map((row) => row[colIndex] ?? "");
    return inferColumnType(values);
  });

  const uniqueCounts = headers.map((_, colIndex) => {
    const values = dataRows.map((row) => (row[colIndex] ?? "").trim()).filter((v) => v !== "");
    return new Set(values).size;
  });

  const nullCounts = headers.map((_, colIndex) => {
    const values = dataRows.map((row) => row[colIndex] ?? "");
    return values.filter((v) => v.trim() === "").length;
  });

  const datasetName =
    typeof nameField === "string" && nameField.trim()
      ? nameField.trim()
      : fileField instanceof File
        ? fileField.name.replace(/\.[^.]+$/, "")
        : "Imported dataset";

  const description =
    typeof descriptionField === "string" && descriptionField.trim()
      ? descriptionField.trim()
      : "CSV imported from the UI";

  const datasetInsert = await db
    .prepare(
      `INSERT INTO datasets (
        name, description, source_type, storage_key, preview_key,
        row_count, column_count, target_column
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      datasetName,
      description,
      "csv",
      "",
      "",
      rowCount,
      headers.length,
      normalizedTarget
    )
    .run();

  const datasetId = Number(datasetInsert.meta.last_row_id);
  const tableName = `dataset_${datasetId}`;

  await db
    .prepare(
      `UPDATE datasets
       SET storage_key = ?, preview_key = ?
       WHERE id = ?`
    )
    .bind(tableName, tableName, datasetId)
    .run();

  const columnDefs = headers
    .map((header, i) => `"${header}" ${inferredTypes[i]}`)
    .join(", ");

  await db.exec(`CREATE TABLE IF NOT EXISTS "${tableName}" (${columnDefs});`);

  const insertSql = `INSERT INTO "${tableName}" (${headers.map((h) => `"${h}"`).join(", ")}) VALUES (${headers.map(() => "?").join(", ")})`;
  const statements: D1PreparedStatement[] = [];

  for (const row of dataRows) {
    const values = headers.map((_, colIndex) =>
      coerceValue(row[colIndex] ?? "", inferredTypes[colIndex])
    );
    statements.push(db.prepare(insertSql).bind(...values));
  }

  for (let i = 0; i < statements.length; i += 50) {
    await db.batch(statements.slice(i, i + 50));
  }

  const columnStatements = headers.map((header, i) =>
    db
      .prepare(
        `INSERT INTO dataset_columns (
          dataset_id,
          column_name,
          data_type,
          is_target,
          has_nulls,
          null_count,
          unique_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        datasetId,
        header,
        inferredTypes[i],
        header === normalizedTarget ? 1 : 0,
        nullCounts[i] > 0 ? 1 : 0,
        nullCounts[i],
        uniqueCounts[i]
      )
  );

  for (let i = 0; i < columnStatements.length; i += 50) {
    await db.batch(columnStatements.slice(i, i + 50));
  }

  const preview = dataRows.slice(0, 10).map((row) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((header, colIndex) => {
      obj[header] = coerceValue(row[colIndex] ?? "", inferredTypes[colIndex]);
    });
    return obj;
  });

  const problemType =
    typeof problemTypeField === "string" && problemTypeField.trim()
      ? problemTypeField.trim()
      : inferredTypes[headers.indexOf(normalizedTarget)] === "TEXT"
        ? "classification"
        : "regression";

  return json({
    ok: true,
    dataset_id: datasetId,
    table_name: tableName,
    dataset: {
      id: datasetId,
      name: datasetName,
      description,
      source_type: "csv",
      storage_key: tableName,
      preview_key: tableName,
      row_count: rowCount,
      column_count: headers.length,
      target_column: normalizedTarget,
      problem_type: problemType,
    },
    columns: headers.map((header, i) => ({
      column_name: header,
      data_type: inferredTypes[i],
      is_target: header === normalizedTarget ? 1 : 0,
      has_nulls: nullCounts[i] > 0 ? 1 : 0,
      null_count: nullCounts[i],
      unique_count: uniqueCounts[i],
    })),
    preview,
    stats: {
      total_rows: rowCount,
      target_column: normalizedTarget,
      problem_type: problemType,
    },
  });
}

async function executeSql(db: D1Database, body: any) {
  const query = String(body?.query ?? "").trim();
  if (!query) {
    return json({ ok: false, error: "query is required" }, 400);
  }

  const keyword = query.split(/\s+/)[0].toUpperCase();
  const datasetId = body?.datasetId ? Number(body.datasetId) : null;
  const queryName =
    typeof body?.queryName === "string" && body.queryName.trim()
      ? body.queryName.trim()
      : query.slice(0, 80);

  try {
    let results: unknown[] = [];
    let meta: unknown = null;

    if (["SELECT", "WITH", "PRAGMA", "EXPLAIN"].includes(keyword)) {
      const res = await db.prepare(query).all();
      results = res.results ?? [];
      meta = res.meta ?? null;
    } else {
      const res = await db.prepare(query).run();
      meta = res.meta ?? null;
    }

    await db
      .prepare(
        `INSERT INTO sql_queries (dataset_id, query_name, query_text, created_at)
         VALUES (?, ?, ?, datetime('now'))`
      )
      .bind(datasetId, queryName, query)
      .run();

    return json({ ok: true, results, meta });
  } catch (error: any) {
    return json(
      {
        ok: false,
        error: error?.message ?? "Error executing SQL",
      },
      400
    );
  }
}

async function handleBenchmark(db: D1Database, body: any, single = false) {
  const datasetId = Number(body?.datasetId);
  const taskType = (body?.taskType ?? "classification") as TaskType;

  if (!datasetId || !Number.isFinite(datasetId)) {
    return json({ ok: false, error: "datasetId is required" }, 400);
  }

  const dataset = await getDatasetById(db, datasetId);
  if (!dataset) {
    return json({ ok: false, error: "Dataset not found" }, 404);
  }

  const targetColumn =
    typeof body?.targetColumn === "string" && body.targetColumn.trim()
      ? sanitizeIdentifier(body.targetColumn)
      : String(dataset.target_column ?? "").trim();

  if (!targetColumn) {
    return json({ ok: false, error: "targetColumn is required" }, 400);
  }

  const trainSplit = Number(body?.trainSplit ?? 80);
  const randomState = Number(body?.randomState ?? 42);

  const allowedModels =
    taskType === "regression"
      ? getDefaultModels("regression")
      : getDefaultModels("classification");

  const selectedModels = single
    ? [String(body?.modelName ?? "")].filter(Boolean)
    : Array.isArray(body?.models) && body.models.length > 0
      ? body.models.map(String)
      : allowedModels;

  if (selectedModels.length === 0) {
    return json({ ok: false, error: "No models selected" }, 400);
  }

  const paramsByModel: Record<string, Record<string, string | number | boolean>> =
    body?.paramsByModel && typeof body.paramsByModel === "object"
      ? body.paramsByModel
      : {};

  const experimentName =
    typeof body?.experimentName === "string" && body.experimentName.trim()
      ? body.experimentName.trim()
      : single
        ? `Single model run - ${selectedModels[0]}`
        : `Benchmark - ${taskType} - ${dataset.name}`;

  const experimentInsert = await db
    .prepare(
      `INSERT INTO experiments (
        dataset_id,
        experiment_name,
        problem_type,
        target_column,
        train_size,
        test_size,
        random_state
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      datasetId,
      experimentName,
      taskType,
      targetColumn,
      Number((trainSplit / 100).toFixed(2)),
      Number(((100 - trainSplit) / 100).toFixed(2)),
      randomState
    )
    .run();

  const experimentId = Number(experimentInsert.meta.last_row_id);
  const results: BenchRun[] = [];

  for (const modelName of selectedModels) {
    const defaults = getDefaultParams(modelName);
    const userParams = paramsByModel?.[modelName] ?? {};
    const params = { ...defaults, ...userParams };

    const run = buildRunResult(
      datasetId,
      taskType,
      modelName,
      params,
      targetColumn,
      trainSplit
    );

    const runInsert = await db
      .prepare(
        `INSERT INTO model_runs (
          experiment_id,
          model_name,
          status,
          started_at,
          finished_at,
          duration_ms,
          error_message
        ) VALUES (?, ?, ?, datetime('now'), datetime('now'), ?, ?)`
      )
      .bind(
        experimentId,
        modelName,
        run.success ? "done" : "failed",
        run.duration_ms,
        run.error ?? null
      )
      .run();

    const runId = Number(runInsert.meta.last_row_id);

    await db
      .prepare(`INSERT INTO model_configs (run_id, params_json) VALUES (?, ?)`)
      .bind(runId, JSON.stringify(params))
      .run();

    if (run.success && run.metrics) {
      for (const [metricName, metricValue] of Object.entries(run.metrics)) {
        await db
          .prepare(`INSERT INTO metrics (run_id, metric_name, metric_value) VALUES (?, ?, ?)`)
          .bind(runId, metricName, metricValue)
          .run();
      }
    }

    await db
      .prepare(
        `INSERT INTO artifacts (run_id, artifact_type, artifact_key, created_at)
         VALUES (?, ?, ?, datetime('now'))`
      )
      .bind(runId, "run_summary", `experiments/${experimentId}/runs/${runId}.json`)
      .run();

    results.push({ ...run, params });
  }

  const ranking = [...results].sort((a, b) => {
    const aOk = a.success && a.score !== null;
    const bOk = b.success && b.score !== null;
    if (aOk !== bOk) return aOk ? -1 : 1;
    return Number(b.score ?? -Infinity) - Number(a.score ?? -Infinity);
  });

  await db
    .prepare(
      `INSERT INTO artifacts (run_id, artifact_type, artifact_key, created_at)
       VALUES (?, ?, ?, datetime('now'))`
    )
    .bind(experimentId, "leaderboard", `experiments/${experimentId}/leaderboard.json`)
    .run();

  return json({
    ok: true,
    experimentId,
    datasetId,
    taskType,
    targetColumn,
    ranking: ranking.map((r) => ({
      model: r.model,
      success: r.success,
      score: r.score,
      duration_ms: r.duration_ms,
      error: r.error ?? null,
      params: r.params,
      metrics: r.metrics ?? null,
    })),
    runs: results,
  });
}

async function getModelSpecPayload() {
  return {
    ok: true,
    regression: REGRESSION_MODELS,
    classification: CLASSIFICATION_MODELS,
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    await initDb(env.DB);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);
    const { pathname, searchParams } = url;

    if (pathname === "/api/health") {
      return json({ ok: true, service: "ml-studio-api" });
    }

    if (pathname === "/api/models" && request.method === "GET") {
      return json(await getModelSpecPayload());
    }

    if (pathname === "/api/datasets" && request.method === "GET") {
      const datasets = await fetchRows(env.DB, "SELECT * FROM datasets ORDER BY id ASC");
      const enriched = await Promise.all(
        (datasets as any[]).map(async (dataset) => {
          const profile = await getDatasetProfile(env.DB, Number(dataset.id));
          return profile?.dataset ?? dataset;
        })
      );

      return json({ ok: true, datasets: enriched });
    }

    if (pathname === "/api/datasets" && request.method === "POST") {
      const body = await parseJson(request);
      if (!body?.name || !body?.source_type) {
        return json({ ok: false, error: "name and source_type are required" }, 400);
      }

      const result = await env.DB.prepare(
        `INSERT INTO datasets (
          name, description, source_type, storage_key, preview_key, row_count, column_count, target_column
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          body.name,
          body.description ?? null,
          body.source_type,
          body.storage_key ?? null,
          body.preview_key ?? null,
          body.row_count ?? null,
          body.column_count ?? null,
          body.target_column ?? null
        )
        .run();

      return json({ ok: true, dataset_id: result.meta.last_row_id }, 201);
    }

    if (pathname === "/api/datasets/import" && request.method === "POST") {
      return importCsvDataset(env.DB, request);
    }

    const profileMatch = pathname.match(/^\/api\/datasets\/(\d+)\/profile$/);
    const datasetMatch = pathname.match(/^\/api\/datasets\/(\d+)$/);

    if ((profileMatch || datasetMatch) && request.method === "GET") {
      const id = Number(profileMatch?.[1] ?? datasetMatch?.[1]);
      const profile = await getDatasetProfile(env.DB, id);

      if (!profile) {
        return json({ ok: false, error: "Dataset not found" }, 404);
      }

      return json(profile);
    }

    const datasetExperimentsMatch = pathname.match(/^\/api\/datasets\/(\d+)\/experiments$/);
    if (datasetExperimentsMatch && request.method === "GET") {
      const datasetId = Number(datasetExperimentsMatch[1]);
      const experiments = await listExperiments(env.DB, datasetId);
      return json({ ok: true, experiments });
    }

    if (pathname === "/api/sql/execute" && request.method === "POST") {
      const body = await parseJson(request);
      return executeSql(env.DB, body);
    }

    if (pathname === "/api/sql/history" && request.method === "GET") {
      const datasetId = searchParams.get("datasetId");
      const queries = datasetId
        ? await fetchRows(
            env.DB,
            "SELECT * FROM sql_queries WHERE dataset_id = ? ORDER BY id DESC",
            [Number(datasetId)]
          )
        : await fetchRows(env.DB, "SELECT * FROM sql_queries ORDER BY id DESC");

      return json({ ok: true, queries });
    }

    if (pathname === "/api/experiments" && request.method === "GET") {
      const datasetIdParam = searchParams.get("datasetId");
      const experiments = await listExperiments(
        env.DB,
        datasetIdParam ? Number(datasetIdParam) : undefined
      );

      return json({ ok: true, experiments });
    }

    const experimentMatch = pathname.match(/^\/api\/experiments\/(\d+)$/);
    if (experimentMatch && request.method === "GET") {
      const experimentId = Number(experimentMatch[1]);
      const details = await getExperimentDetails(env.DB, experimentId);

      if (!details) {
        return json({ ok: false, error: "Experiment not found" }, 404);
      }

      return json({ ok: true, ...details });
    }

    if (pathname === "/api/train" && request.method === "POST") {
      const body = await parseJson(request);
      if (!body?.datasetId || !body?.modelName) {
        return json({ ok: false, error: "datasetId and modelName are required" }, 400);
      }

      const dataset = await getDatasetById(env.DB, Number(body.datasetId));
      const taskType = (body?.taskType ?? dataset?.inferred_problem_type ?? "classification") as TaskType;

      return handleBenchmark(
        env.DB,
        {
          ...body,
          taskType,
          modelName: body.modelName,
          models: [body.modelName],
        },
        true
      );
    }

    if (pathname === "/api/train-all" && request.method === "POST") {
      const body = await parseJson(request);
      return handleBenchmark(env.DB, body, false);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    if (pathname.startsWith("/api/") || pathname.includes(".")) {
      return assetResponse;
    }

    const spaUrl = new URL(request.url);
    spaUrl.pathname = "/";
    return env.ASSETS.fetch(new Request(spaUrl.toString(), request));
  },
};