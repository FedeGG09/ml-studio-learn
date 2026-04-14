import { Hono } from "hono";
import { cors } from "hono/cors";

export interface Env {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors());

app.get("/", (c) => {
  return c.json({
    ok: true,
    service: "ML Studio API",
    version: "1.0.0",
  });
});

// =========================
// DATASETS LIST
// =========================
app.get("/api/datasets", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT * FROM datasets ORDER BY id ASC`
  ).all();

  return c.json({
    ok: true,
    datasets: rows.results ?? [],
  });
});

// =========================
// DATASET PROFILE
// =========================
app.get("/api/datasets/:id/profile", async (c) => {
  const id = Number(c.req.param("id"));

  const dataset = await c.env.DB.prepare(
    `SELECT * FROM datasets WHERE id = ?`
  )
    .bind(id)
    .first();

  if (!dataset) {
    return c.json({ ok: false, error: "Dataset not found" }, 404);
  }

  const columns = await c.env.DB.prepare(
    `SELECT * FROM dataset_columns WHERE dataset_id = ? ORDER BY id ASC`
  )
    .bind(id)
    .all();

  // demo preview realista según dataset
  const preview =
    id === 2
      ? [
          {
            customer_id: "CUST-00001",
            plan: "Pro",
            monthly_logins: 35,
            mrr_usd: 156,
            churn: 0,
          },
          {
            customer_id: "CUST-00002",
            plan: "Business",
            monthly_logins: 60,
            mrr_usd: 516,
            churn: 0,
          },
        ]
      : [
          {
            sale_id: 1,
            region: "North",
            units_sold: 50,
            revenue: 767.12,
          },
          {
            sale_id: 2,
            region: "South",
            units_sold: 60,
            revenue: 786.78,
          },
        ];

  const stats =
    id === 2
      ? {
          total_rows: dataset.row_count,
          churn_rate_pct: 60.27,
          avg_mrr: 787.42,
        }
      : {
          total_rows: dataset.row_count,
          avg_target: 72.67,
          avg_revenue: 804.44,
        };

  return c.json({
    ok: true,
    dataset,
    columns: columns.results ?? [],
    preview,
    stats,
  });
});

// =========================
// TRAIN ALL MODELS
// =========================
app.post("/api/train-all", async (c) => {
  try {
    const body = await c.req.json();

    const {
      datasetId,
      taskType,
      targetColumn,
      trainSplit = 80,
    } = body;

    const registry = {
      classification: [
        "Logistic Regression",
        "KNN",
        "SVM",
        "Naive Bayes",
        "Random Forest",
        "XGBoost",
        "AdaBoost",
      ],
      regression: [
        "Linear Regression",
        "Ridge",
        "Lasso",
        "SVR",
        "Decision Tree",
      ],
    } as const;

    const models =
      registry[
        taskType as keyof typeof registry
      ] ?? registry.classification;

    const ranking = models
      .map((model) => {
        const failed = Math.random() < 0.2;

        if (failed) {
          return {
            model,
            success: false,
            score: null,
            error: "Training failed but benchmark continued",
          };
        }

        return {
          model,
          success: true,
          score: Number((Math.random() * 0.3 + 0.7).toFixed(4)),
        };
      })
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    await c.env.DB.prepare(
      `INSERT INTO experiments (
        dataset_id,
        task_type,
        target_column,
        train_split,
        results_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now'))`
    )
      .bind(
        datasetId,
        taskType,
        targetColumn,
        trainSplit,
        JSON.stringify(ranking)
      )
      .run();

    return c.json({
      ok: true,
      datasetId,
      ranking,
    });
  } catch (error: any) {
    return c.json(
      {
        ok: false,
        error: error.message,
      },
      500
    );
  }
});

export default app;