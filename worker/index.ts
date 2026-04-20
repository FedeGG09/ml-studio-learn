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

type DerivedColumnSpec = {
  name: string;
  op: "concat" | "sum" | "difference" | "product" | "ratio";
  left: string;
  right?: string;
  separator?: string;
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

async function parseJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function tableExists(db: D1Database, table: string) {
  const row = await db
    .prepare(
      `SELECT name
       FROM sqlite_master
       WHERE type = 'table' AND name = ?`
    )
    .bind(table)
    .first<{ name: string }>();

  return !!row;
}

async function columnExists(db: D1Database, table: string, column: string) {
  const res = await db.prepare(`PRAGMA table_info("${table}")`).all<any>();
  const rows = (res.results ?? []) as Array<{ name?: string }>;
  return rows.some((r) => r.name === column);
}

async function ensureColumn(
  db: D1Database,
  table: string,
  column: string,
  definition: string
) {
  const exists = await columnExists(db, table, column);
  if (!exists) {
    await db.exec(`ALTER TABLE "${table}" ADD COLUMN ${column} ${definition};`);
  }
}

async function ensureCompatibility(db: D1Database) {
  const hasDatasets = await tableExists(db, "datasets");
  if (hasDatasets) {
    await ensureColumn(db, "datasets", "name", "TEXT");
    await ensureColumn(db, "datasets", "description", "TEXT");
    await ensureColumn(db, "datasets", "parent_dataset_id", "INTEGER");
    await ensureColumn(db, "datasets", "version_name", "TEXT");
    await ensureColumn(db, "datasets", "prep_config_json", "TEXT");
  }

  const hasExperiments = await tableExists(db, "experiments");
  if (hasExperiments) {
    await ensureColumn(db, "experiments", "task_type", "TEXT");
    await ensureColumn(db, "experiments", "train_split", "INTEGER");
    await ensureColumn(db, "experiments", "results_json", "TEXT");
    await ensureColumn(db, "experiments", "hyperparams_json", "TEXT");
    await ensureColumn(db, "experiments", "feature_columns_json", "TEXT");
  }

  await db.exec(`
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
  `);

  await db.exec(`
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
  `);

  await db.exec(`
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
  `);
}

async function initDb(db: D1Database) {
  if (!initPromise) {
    initPromise = ensureCompatibility(db).then(() => undefined);
  }
  await initPromise;
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

function quoteIdent(value: string) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function buildDerivedExpression(col: DerivedColumnSpec) {
  const left = quoteIdent(col.left);
  const right = col.right ? quoteIdent(col.right) : null;

  switch (col.op) {
    case "concat":
      if (!right) {
        return `COALESCE(${left}, '')`;
      }
      return `COALESCE(${left}, '') || '${(col.separator ?? " ").replace(/'/g, "''")}' || COALESCE(${right}, '')`;
    case "sum":
      return right ? `${left} + ${right}` : "NULL";
    case "difference":
      return right ? `${left} - ${right}` : "NULL";
    case "product":
      return right ? `${left} * ${right}` : "NULL";
    case "ratio":
      return right ? `${left} / NULLIF(${right}, 0)` : "NULL";
  }
}

function inferredDerivedType(op: DerivedColumnSpec["op"]) {
  return op === "concat" ? "TEXT" : "REAL";
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
  const stmt = params.length ? db.prepare(sql).bind(...params) : db.prepare(sql);
  const { results } = await stmt.all();
  return results ?? [];
}

async function fetchSingle(db: D1Database, sql: string, params: any[] = []) {
  const stmt = params.length ? db.prepare(sql).bind(...params) : db.prepare(sql);
  return stmt.first<any>();
}

async function getDatasetById(db: D1Database, id: number) {
  return fetchSingle(db, "SELECT * FROM datasets WHERE id = ?", [id]);
}

async function getLatestPreparation(db: D1Database, datasetId: number) {
  return fetchSingle(
    db,
    "SELECT * FROM dataset_preparations WHERE dataset_id = ? ORDER BY id DESC LIMIT 1",
    [datasetId]
  );
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
  const targetType = targetMeta?.data_type ? String(targetMeta.data_type).toUpperCase() : "";
  const targetUniqueCount = Number(targetMeta?.unique_count ?? 0);

  let stats: Record<string, unknown> = {
    total_rows: Number(dataset.row_count) || preview.length || 0,
  };

  if (safeTable && targetColumn) {
    if (targetType === "TEXT") {
      const row = await fetchSingle(
        db,
        `SELECT
           COUNT(*) AS total_rows,
           COUNT(DISTINCT "${targetColumn}") AS class_count
         FROM "${safeTable}"`
      );
      stats = {
        total_rows: Number(row?.total_rows ?? 0),
        class_count: Number(row?.class_count ?? 0),
      };
    } else if (["INTEGER", "REAL"].includes(targetType) && targetUniqueCount <= 2) {
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
    } else if (["INTEGER", "REAL"].includes(targetType)) {
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
    targetType === "TEXT"
      ? "classification"
      : ["INTEGER", "REAL"].includes(targetType) && targetUniqueCount <= 2
        ? "classification"
        : "regression";

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

      return { ...run, score };
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
      task_type: exp.task_type ?? exp.problem_type ?? null,
      target_column: exp.target_column,
      train_size: exp.train_size,
      test_size: exp.test_size,
      train_split: exp.train_split ?? null,
      random_state: exp.random_state,
      results_json: exp.results_json ?? null,
      hyperparams_json: exp.hyperparams_json ?? null,
      feature_columns_json: exp.feature_columns_json ?? null,
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

function getOutputName(originalName: string, renameMap: Record<string, string>) {
  const renamed = typeof renameMap[originalName] === "string" ? renameMap[originalName].trim() : "";
  return renamed || originalName;
}

function buildRunResult(
  datasetId: number,
  taskType: TaskType,
  modelName: string,
  params: Record<string, string | number | boolean>,
  targetColumn: string,
  trainSplit: number
): BenchRun {
  const seed = stableNoise(
    datasetId,
    taskType,
    modelName,
    targetColumn,
    trainSplit,
    JSON.stringify(params)
  );
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
      metrics: { accuracy, precision, recall, f1, roc_auc, score: f1 },
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
    metrics: { rmse, mae, r2, score: r2 },
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
    featureColumns?: string[];
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
        random_state,
        task_type,
        train_split,
        results_json,
        hyperparams_json,
        feature_columns_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      input.datasetId,
      input.experimentName,
      input.taskType,
      input.targetColumn,
      input.trainSplit / 100,
      (100 - input.trainSplit) / 100,
      input.randomState,
      input.taskType,
      input.trainSplit,
      null,
      JSON.stringify(input.paramsByModel ?? {}),
      JSON.stringify(input.featureColumns ?? [])
    )
    .run();

  const experimentId = Number(experimentInsert.meta.last_row_id);
  const results: BenchRun[] = [];
  let firstRunId: number | null = null;

  for (const modelName of input.selectedModels) {
    const params = {
      ...getDefaultParams(modelName),
      ...(input.paramsByModel?.[modelName] ?? {}),
    };

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
    if (!firstRunId) firstRunId = runId;

    await db
      .prepare(`INSERT INTO model_configs (run_id, params_json) VALUES (?, ?)`)
      .bind(runId, JSON.stringify(params))
      .run();

    if (run.metrics) {
      for (const [metricName, metricValue] of Object.entries(run.metrics)) {
        await db
          .prepare(`INSERT INTO metrics (run_id, metric_name, metric_value) VALUES (?, ?, ?)`)
          .bind(runId, metricName, metricValue)
          .run();
      }
    }

    await db
      .prepare(
        `INSERT INTO artifacts (run_id, artifact_type, artifact_key)
         VALUES (?, ?, ?)`
      )
      .bind(runId, "run_summary", `experiments/${experimentId}/runs/${runId}.json`)
      .run();

    results.push({ ...run, params });
  }

  const ranking = [...results].sort((a, b) => Number(b.score ?? -999) - Number(a.score ?? -999));

  if (firstRunId) {
    await db
      .prepare(
        `INSERT INTO artifacts (run_id, artifact_type, artifact_key)
         VALUES (?, ?, ?)`
      )
      .bind(firstRunId, "leaderboard", `experiments/${experimentId}/leaderboard.json`)
      .run();
  }

  await db
    .prepare(
      `UPDATE experiments
       SET results_json = ?, hyperparams_json = ?
       WHERE id = ?`
    )
    .bind(
      JSON.stringify({
        ranking,
        runs: results,
      }),
      JSON.stringify(input.paramsByModel ?? {}),
      experimentId
    )
    .run();

  return { experimentId, results, ranking };
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

  const parsed = parseCsv(rawText.replace(/^\uFEFF/, ""));
  if (parsed.length < 2) {
    return json({ ok: false, error: "CSV must contain header and at least one row" }, 400);
  }

  const headers = uniqueNames(parsed[0].map((h) => sanitizeIdentifier(h || "column")));
  if (headers.length === 0) {
    return json({ ok: false, error: "CSV header is empty" }, 400);
  }

  if (headers.length > 80) {
    return json({ ok: false, error: "CSV has too many columns for D1 import" }, 400);
  }

  const dataRows = parsed
    .slice(1)
    .filter((row) => row.some((cell) => (cell ?? "").trim() !== ""));

  const rowCount = dataRows.length;

  const normalizedTarget =
    typeof targetColumnField === "string" && targetColumnField.trim()
      ? sanitizeIdentifier(targetColumnField)
      : headers[headers.length - 1];

  const targetIndex = headers.indexOf(normalizedTarget);
  const finalTarget = targetIndex >= 0 ? normalizedTarget : headers[headers.length - 1];
  const finalTargetIndex = headers.indexOf(finalTarget);

  const inferredTypes = headers.map((_, colIndex) => {
    const values = dataRows.map((row) => row[colIndex] ?? "");
    return inferColumnType(values);
  });

  const uniqueCounts = headers.map((_, colIndex) => {
    const values = dataRows
      .map((row) => (row[colIndex] ?? "").trim())
      .filter((v) => v !== "");
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
      finalTarget
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

  await db.exec(`DROP TABLE IF EXISTS "${tableName}";`);
  await db.exec(`CREATE TABLE "${tableName}" (${columnDefs});`);

  const insertSql = `INSERT INTO "${tableName}" (${headers
    .map((h) => `"${h}"`)
    .join(", ")}) VALUES (${headers.map(() => "?").join(", ")})`;

  const statements: D1PreparedStatement[] = [];
  for (const rawRow of dataRows) {
    const row = [...rawRow];
    while (row.length < headers.length) row.push("");
    if (row.length > headers.length) row.length = headers.length;

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
        i === finalTargetIndex ? 1 : 0,
        nullCounts[i] > 0 ? 1 : 0,
        nullCounts[i],
        uniqueCounts[i]
      )
  );

  for (let i = 0; i < columnStatements.length; i += 50) {
    await db.batch(columnStatements.slice(i, i + 50));
  }

  const preview = dataRows.slice(0, 10).map((rawRow) => {
    const row = [...rawRow];
    while (row.length < headers.length) row.push("");
    if (row.length > headers.length) row.length = headers.length;

    const obj: Record<string, unknown> = {};
    headers.forEach((header, colIndex) => {
      obj[header] = coerceValue(row[colIndex] ?? "", inferredTypes[colIndex]);
    });
    return obj;
  });

  const inferredProblemType =
    finalTargetIndex >= 0 && inferredTypes[finalTargetIndex] === "TEXT"
      ? "classification"
      : "regression";

  const problemType =
    typeof problemTypeField === "string" && problemTypeField.trim()
      ? (problemTypeField.trim() as "regression" | "classification")
      : inferredProblemType;

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
      target_column: finalTarget,
      problem_type: problemType,
    },
    columns: headers.map((header, i) => ({
      column_name: header,
      data_type: inferredTypes[i],
      is_target: i === finalTargetIndex ? 1 : 0,
      has_nulls: nullCounts[i] > 0 ? 1 : 0,
      null_count: nullCounts[i],
      unique_count: uniqueCounts[i],
    })),
    preview,
    stats: {
      total_rows: rowCount,
      target_column: finalTarget,
      problem_type: problemType,
    },
  });
}

async function handlePrepareDataset(db: D1Database, datasetId: number, body: any) {
  const dataset = await getDatasetById(db, datasetId);
  if (!dataset) return json({ ok: false, error: "Dataset not found" }, 404);

  const profile = await getDatasetProfile(db, datasetId);
  if (!profile) return json({ ok: false, error: "Dataset profile not found" }, 404);

  const sourceColumns = await fetchRows(
    db,
    "SELECT * FROM dataset_columns WHERE dataset_id = ? ORDER BY id ASC",
    [datasetId]
  );

  if (!sourceColumns.length) {
    return json({ ok: false, error: "Dataset has no column metadata" }, 400);
  }

  const sourceColumnsMap = new Map<
    string,
    { data_type: string; is_target: number; column_name: string }
  >();

  for (const col of sourceColumns as any[]) {
    sourceColumnsMap.set(String(col.column_name), {
      data_type: String(col.data_type ?? "TEXT").toUpperCase(),
      is_target: Number(col.is_target ?? 0),
      column_name: String(col.column_name),
    });
  }

  const targetColumn = String(body?.targetColumn ?? dataset.target_column ?? "").trim();
  const versionName = String(body?.versionName ?? "Prepared version").trim();
  const rawSelectedFeatures = Array.isArray(body?.selectedFeatures) ? body.selectedFeatures.map(String) : [];
  const renameMap =
    body?.renameMap && typeof body.renameMap === "object" && !Array.isArray(body.renameMap)
      ? (body.renameMap as Record<string, string>)
      : {};
  const rawDerivedColumns = Array.isArray(body?.derivedColumns) ? body.derivedColumns : [];
  const taskType = String(body?.taskType ?? dataset?.inferred_problem_type ?? "classification").trim() as TaskType;

  if (!targetColumn) return json({ ok: false, error: "targetColumn is required" }, 400);
  if (!sourceColumnsMap.has(targetColumn)) {
    return json({ ok: false, error: "targetColumn not found in dataset columns" }, 400);
  }

  const selectedFeatures = Array.from(
    new Set(
      rawSelectedFeatures
        .map((v) => String(v).trim())
        .filter(Boolean)
        .filter((v) => v !== targetColumn)
    )
  );

  if (selectedFeatures.length === 0) {
    return json({ ok: false, error: "Select at least one feature" }, 400);
  }

  const invalidFeatures = selectedFeatures.filter((f) => !sourceColumnsMap.has(f));
  if (invalidFeatures.length > 0) {
    return json(
      {
        ok: false,
        error: `Unknown selected features: ${invalidFeatures.join(", ")}`,
      },
      400
    );
  }

  const derivedColumns: DerivedColumnSpec[] = [];
  for (const raw of rawDerivedColumns) {
    const name = String(raw?.name ?? "").trim();
    const op = String(raw?.op ?? "").trim() as DerivedColumnSpec["op"];
    const left = String(raw?.left ?? "").trim();
    const right = typeof raw?.right === "string" ? raw.right.trim() : "";
    const separator = typeof raw?.separator === "string" ? raw.separator : " ";

    if (!name || !left) continue;
    if (!["concat", "sum", "difference", "product", "ratio"].includes(op)) continue;

    if (!sourceColumnsMap.has(left)) {
      return json({ ok: false, error: `Derived column "${name}" references unknown left column "${left}"` }, 400);
    }

    if (op !== "concat" && !right) {
      return json({ ok: false, error: `Derived column "${name}" requires a right column` }, 400);
    }

    if (right && !sourceColumnsMap.has(right)) {
      return json({ ok: false, error: `Derived column "${name}" references unknown right column "${right}"` }, 400);
    }

    derivedColumns.push({
      name,
      op,
      left,
      right: right || undefined,
      separator,
    });
  }

  const preparedTable = `prepared_${datasetId}_${Date.now()}`;
  const sourceTable = resolveDatasetTableName(dataset);
  const safeSource = /^[A-Za-z_][A-Za-z0-9_]*$/.test(sourceTable) ? sourceTable : null;
  if (!safeSource) return json({ ok: false, error: "Invalid source table" }, 400);

  const directColumns = [
    ...selectedFeatures,
    targetColumn,
  ].map((originalName) => {
    const meta = sourceColumnsMap.get(originalName);
    return {
      sourceName: originalName,
      outputName: getOutputName(originalName, renameMap),
      dataType: meta?.data_type ?? "TEXT",
      isTarget: originalName === targetColumn ? 1 : 0,
    };
  });

  const derivedMeta = derivedColumns.map((dc) => ({
    sourceName: null as string | null,
    outputName: dc.name,
    dataType: inferredDerivedType(dc.op),
    isTarget: 0,
    expression: buildDerivedExpression(dc),
    config: dc,
  }));

  const outputNames = [...directColumns.map((c) => c.outputName), ...derivedMeta.map((c) => c.outputName)];
  const uniqueOutputNames = new Set(outputNames);
  if (uniqueOutputNames.size !== outputNames.length) {
    return json(
      {
        ok: false,
        error: "There are duplicated output column names after applying renames / derived columns",
      },
      400
    );
  }

  const selectedFeatureOutputs = selectedFeatures.map((name) => getOutputName(name, renameMap));
  const targetOutput = getOutputName(targetColumn, renameMap);

  const columnDefs = [...directColumns, ...derivedMeta]
    .map((col) => `${quoteIdent(col.outputName)} ${col.dataType}`)
    .join(", ");

  const selectFragments = [
    ...directColumns.map(
      (col) => `${quoteIdent(col.sourceName)} AS ${quoteIdent(col.outputName)}`
    ),
    ...derivedMeta.map((col) => `${col.expression} AS ${quoteIdent(col.outputName)}`),
  ];

  await db.exec(`DROP TABLE IF EXISTS ${quoteIdent(preparedTable)};`);
  await db.exec(`CREATE TABLE ${quoteIdent(preparedTable)} (${columnDefs});`);
  await db.exec(
    `INSERT INTO ${quoteIdent(preparedTable)}
     SELECT ${selectFragments.join(", ")}
     FROM ${quoteIdent(safeSource)};`
  );

  const preparedRowCountRow = await fetchSingle(
    db,
    `SELECT COUNT(*) AS total_rows FROM ${quoteIdent(preparedTable)}`
  );
  const preparedColumnRows = await fetchRows(
    db,
    `PRAGMA table_info(${quoteIdent(preparedTable)})`
  );
  const preparedPreview = await fetchRows(
    db,
    `SELECT * FROM ${quoteIdent(preparedTable)} LIMIT 10`
  );

  const sourceRowCount = Number(profile?.stats?.total_rows ?? dataset.row_count ?? preparedRowCountRow?.total_rows ?? 0);
  const preparedColumnCount = preparedColumnRows.length || outputNames.length;

  const preparedDatasetInsert = await db
    .prepare(
      `INSERT INTO datasets (
        name,
        description,
        source_type,
        storage_key,
        preview_key,
        parent_dataset_id,
        version_name,
        prep_config_json,
        row_count,
        column_count,
        target_column
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      `${dataset.name} · ${versionName}`,
      dataset.description ?? "Prepared dataset",
      "prepared",
      preparedTable,
      preparedTable,
      datasetId,
      versionName,
      JSON.stringify({
        sourceDatasetId: datasetId,
        sourceTable: safeSource,
        preparedTable,
        targetColumn,
        targetOutput,
        selectedFeatures,
        selectedFeatureOutputs,
        renameMap,
        derivedColumns,
      }),
      sourceRowCount,
      preparedColumnCount,
      targetOutput
    )
    .run();

  const preparedDatasetId = Number(preparedDatasetInsert.meta.last_row_id);

  const preparedColumnStatements = [...directColumns, ...derivedMeta].map((col) =>
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
        preparedDatasetId,
        col.outputName,
        col.dataType,
        col.isTarget,
        0,
        0,
        0
      )
  );

  for (let i = 0; i < preparedColumnStatements.length; i += 50) {
    await db.batch(preparedColumnStatements.slice(i, i + 50));
  }

  const prepInsert = await db
    .prepare(
      `INSERT INTO dataset_preparations (
        dataset_id,
        version_name,
        source_table,
        prepared_table,
        target_column,
        selected_features_json,
        rename_map_json,
        derived_columns_json,
        prep_config_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      preparedDatasetId,
      versionName,
      safeSource,
      preparedTable,
      targetOutput,
      JSON.stringify(selectedFeatureOutputs),
      JSON.stringify(renameMap),
      JSON.stringify(derivedColumns),
      JSON.stringify({
        sourceDatasetId: datasetId,
        sourceTable: safeSource,
        preparedTable,
        targetColumn,
        targetOutput,
        selectedFeatures,
        selectedFeatureOutputs,
        renameMap,
        derivedColumns,
      })
    )
    .run();

  const preparationId = Number(prepInsert.meta.last_row_id);

  await db
    .prepare(
      `INSERT INTO feature_selections (
        dataset_id,
        preparation_id,
        target_column,
        selected_features_json,
        dropped_features_json,
        task_type
      ) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      preparedDatasetId,
      preparationId,
      targetOutput,
      JSON.stringify(selectedFeatureOutputs),
      JSON.stringify(
        [...sourceColumnsMap.keys()].filter(
          (col) => col !== targetColumn && !selectedFeatures.includes(col)
        )
      ),
      taskType
    )
    .run();

  await db
    .prepare(
      `INSERT INTO dataset_transformations (
        dataset_id,
        preparation_id,
        transformation_type,
        transformation_json
      ) VALUES (?, ?, ?, ?)`
    )
    .bind(
      preparedDatasetId,
      preparationId,
      "prepare_dataset",
      JSON.stringify({
        sourceDatasetId: datasetId,
        sourceTable: safeSource,
        preparedTable,
        versionName,
        targetColumn,
        targetOutput,
        selectedFeatures,
        selectedFeatureOutputs,
        renameMap,
        derivedColumns,
      })
    )
    .run();

  const preparedProfile = await getDatasetProfile(db, preparedDatasetId);

  return json({
    ok: true,
    prepared_dataset_id: preparedDatasetId,
    preparation_id: preparationId,
    table_name: preparedTable,
    dataset: preparedProfile?.dataset ?? {
      id: preparedDatasetId,
      name: `${dataset.name} · ${versionName}`,
      description: dataset.description ?? "Prepared dataset",
      source_type: "prepared",
      storage_key: preparedTable,
      preview_key: preparedTable,
      parent_dataset_id: datasetId,
      version_name: versionName,
      row_count: sourceRowCount,
      column_count: preparedColumnCount,
      target_column: targetOutput,
    },
    columns: preparedProfile?.columns ?? [
      ...directColumns,
      ...derivedMeta,
    ].map((c) => ({
      column_name: c.outputName,
      data_type: c.dataType,
      is_target: c.isTarget,
      has_nulls: 0,
      null_count: 0,
      unique_count: 0,
    })),
    preview: preparedProfile?.preview ?? preparedPreview,
    stats: preparedProfile?.stats ?? {
      total_rows: sourceRowCount,
    },
  });
}

async function executeSql(db: D1Database, body: any) {
  const query = String(body?.query ?? "").trim();
  if (!query) {
    return json({ ok: false, error: "query is required" }, 400);
  }

  const keyword = query.split(/\s+/)[0].toUpperCase();
  if (!["SELECT", "WITH", "PRAGMA", "EXPLAIN"].includes(keyword)) {
    return json(
      {
        ok: false,
        error: "Only read-only SQL is allowed in SQL Lab",
      },
      400
    );
  }

  const datasetId = body?.datasetId ? Number(body.datasetId) : null;
  const queryName =
    typeof body?.queryName === "string" && body.queryName.trim()
      ? body.queryName.trim()
      : query.slice(0, 80);

  try {
    const res = await db.prepare(query).all();
    const results = res.results ?? [];
    const meta = res.meta ?? null;

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
  if (!datasetId) {
    return json({ ok: false, error: "datasetId required" }, 400);
  }

  const dataset = await getDatasetById(db, datasetId);
  if (!dataset) {
    return json({ ok: false, error: "Dataset not found" }, 404);
  }

  const latestPrep = await getLatestPreparation(db, datasetId);

  const taskType = (body?.taskType ?? dataset?.inferred_problem_type ?? "classification") as TaskType;
  const targetColumn =
    String(body?.targetColumn ?? latestPrep?.target_column ?? dataset.target_column ?? "").trim() ||
    "target";

  let featureColumns: string[] = Array.isArray(body?.featureColumns)
    ? body.featureColumns.map(String).map((v: string) => v.trim()).filter(Boolean)
    : [];

  if (featureColumns.length === 0 && latestPrep?.selected_features_json) {
    try {
      const parsed = JSON.parse(String(latestPrep.selected_features_json));
      if (Array.isArray(parsed)) {
        featureColumns = parsed.map(String).map((v: string) => v.trim()).filter(Boolean);
      }
    } catch {
      // ignore parsing issues and fall back below
    }
  }

  if (featureColumns.length === 0) {
    const cols = await fetchRows(
      db,
      "SELECT column_name, is_target FROM dataset_columns WHERE dataset_id = ? ORDER BY id ASC",
      [datasetId]
    );
    featureColumns = (cols as any[])
      .filter((c) => Number(c.is_target ?? 0) !== 1)
      .map((c) => String(c.column_name));
  }

  const selectedModels =
    single
      ? [String(body?.modelName ?? "")].filter(Boolean)
      : Array.isArray(body?.models) && body.models.length > 0
        ? body.models.map(String)
        : getDefaultModels(taskType);

  if (selectedModels.length === 0) {
    return json({ ok: false, error: "No models selected" }, 400);
  }

  const result = await persistBenchmark(db, {
    datasetId,
    taskType,
    targetColumn,
    trainSplit: Number(body?.trainSplit ?? 80),
    experimentName: body?.experimentName || `Benchmark ${dataset.name}`,
    selectedModels,
    randomState: Number(body?.randomState ?? 42),
    paramsByModel: body?.paramsByModel ?? {},
    featureColumns,
  });

  return json({
    ok: true,
    experimentId: result.experimentId,
    ranking: result.ranking,
    runs: result.results,
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
    try {
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

      const prepareMatch = pathname.match(/^\/api\/datasets\/(\d+)\/prepare$/);
      if (prepareMatch && request.method === "POST") {
        const datasetId = Number(prepareMatch[1]);
        const body = await parseJson(request);
        return handlePrepareDataset(env.DB, datasetId, body);
      }

      const preparationsMatch = pathname.match(/^\/api\/datasets\/(\d+)\/preparations$/);
      if (preparationsMatch && request.method === "GET") {
        const datasetId = Number(preparationsMatch[1]);
        const preparations = await fetchRows(
          env.DB,
          "SELECT * FROM dataset_preparations WHERE dataset_id = ? ORDER BY id DESC",
          [datasetId]
        );
        return json({ ok: true, preparations });
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

      if (pathname.startsWith("/api/")) {
        return json({ ok: false, error: "Not found" }, 404);
      }

      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) {
        return assetResponse;
      }

      const spaUrl = new URL(request.url);
      spaUrl.pathname = "/";
      return env.ASSETS.fetch(new Request(spaUrl.toString(), request));
    } catch (error: any) {
      console.error("Worker error:", error);
      return json(
        {
          ok: false,
          error: error?.message ?? "Internal server error",
        },
        500
      );
    }
  },
};