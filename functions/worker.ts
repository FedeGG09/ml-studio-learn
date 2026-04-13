export interface Env {
      { ok: false, error: error?.message ?? "Error ejecutando SQL" },
      { status: 400, headers: corsHeaders(env.CORS_ORIGIN) }
    );
  }
}

async function handleExperiments(request: Request, env: Env) {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/api/experiments") {
    const { results } = await env.DB.prepare(
      "SELECT * FROM experiments ORDER BY created_at DESC"
    ).all();
    return json({ ok: true, experiments: results }, { headers: corsHeaders(env.CORS_ORIGIN) });
  }

  if (request.method === "POST" && url.pathname === "/api/experiments") {
    const body = await parseJson(request);
    if (!body?.dataset_id || !body?.experiment_name || !body?.problem_type || !body?.target_column) {
      return json({ ok: false, error: "Faltan campos requeridos" }, { status: 400, headers: corsHeaders(env.CORS_ORIGIN) });
    }

    const result = await env.DB.prepare(
      `INSERT INTO experiments (dataset_id, experiment_name, problem_type, target_column, train_size, test_size, random_state)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        body.dataset_id,
        body.experiment_name,
        body.problem_type,
        body.target_column,
        body.train_size ?? 0.8,
        body.test_size ?? 0.2,
        body.random_state ?? 42,
      )
      .run();

    return json({ ok: true, experiment_id: result.meta.last_row_id }, { status: 201, headers: corsHeaders(env.CORS_ORIGIN) });
  }

  if (request.method === "GET" && url.pathname.startsWith("/api/experiments/") && url.pathname.endsWith("/runs")) {
    const id = Number(url.pathname.split("/")[3]);
    const { results } = await env.DB.prepare(
      "SELECT * FROM model_runs WHERE experiment_id = ? ORDER BY id DESC"
    ).bind(id).all();
    return json({ ok: true, runs: results }, { headers: corsHeaders(env.CORS_ORIGIN) });
  }

  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(env.CORS_ORIGIN) });
    }

    const url = new URL(request.url);

    const datasets = await handleDatasets(request, env);
    if (datasets) return datasets;

    const sql = await handleSql(request, env);
    if (sql) return sql;

    const experiments = await handleExperiments(request, env);
    if (experiments) return experiments;

    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "ml-studio-learn-api" }, { headers: corsHeaders(env.CORS_ORIGIN) });
    }

    return json({ ok: false, error: "Not found" }, { status: 404, headers: corsHeaders(env.CORS_ORIGIN) });
  },
};
