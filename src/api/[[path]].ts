interface Env {
  DB: D1Database;
  CORS_ORIGIN: string;
}

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  };
}

function json(data: unknown, init: ResponseInit = {}, origin = "*") {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(origin),
      ...(init.headers || {}),
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

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const origin = env.CORS_ORIGIN || "*";

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(origin) });
  }

  if (url.pathname === "/api/health") {
    return json({ ok: true, service: "ml-studio-learn-api" }, {}, origin);
  }

  if (request.method === "GET" && url.pathname === "/api/datasets") {
    const { results } = await env.DB.prepare(
      "SELECT * FROM datasets ORDER BY created_at DESC"
    ).all();
    return json({ ok: true, datasets: results }, {}, origin);
  }

  if (request.method === "GET" && url.pathname.match(/^\/api\/datasets\/\d+\/profile$/)) {
    const id = Number(url.pathname.split("/")[3]);
    const dataset = await env.DB.prepare("SELECT * FROM datasets WHERE id = ?")
      .bind(id)
      .first<any>();

    if (!dataset) {
      return json({ ok: false, error: "Dataset no encontrado" }, { status: 404 }, origin);
    }

    const columns = await env.DB.prepare(
      "SELECT * FROM dataset_columns WHERE dataset_id = ? ORDER BY id ASC"
    )
      .bind(id)
      .all();

    return json({ ok: true, dataset, columns: columns.results }, {}, origin);
  }

  if (request.method === "POST" && url.pathname === "/api/datasets") {
    const body = await parseJson(request);
    if (!body?.name || !body?.source_type) {
      return json({ ok: false, error: "Faltan campos requeridos" }, { status: 400 }, origin);
    }

    const result = await env.DB.prepare(
      `INSERT INTO datasets
       (name, description, source_type, storage_key, preview_key, row_count, column_count, target_column)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        body.name,
        body.description ?? null,
        body.source_type,
        body.storage_key ?? null,
        body.preview_key ?? null,
        body.row_count ?? null,
        body.column_count ?? null,
        body.target_column ?? null,
      )
      .run();

    return json({ ok: true, dataset_id: result.meta.last_row_id }, { status: 201 }, origin);
  }

  if (request.method === "DELETE" && url.pathname.match(/^\/api\/datasets\/\d+$/)) {
    const id = Number(url.pathname.split("/")[3]);
    await env.DB.prepare("DELETE FROM dataset_columns WHERE dataset_id = ?").bind(id).run();
    await env.DB.prepare("DELETE FROM datasets WHERE id = ?").bind(id).run();
    return json({ ok: true }, {}, origin);
  }

  if (request.method === "POST" && url.pathname === "/api/sql/execute") {
    const body = await parseJson(request);
    if (!body?.query) {
      return json({ ok: false, error: "query es requerido" }, { status: 400 }, origin);
    }

    try {
      const { results, meta } = await env.DB.prepare(body.query).all();
      return json({ ok: true, results, meta }, {}, origin);
    } catch (error: any) {
      return json(
        { ok: false, error: error?.message ?? "Error ejecutando SQL" },
        { status: 400 },
        origin
      );
    }
  }

  if (request.method === "GET" && url.pathname === "/api/experiments") {
    const { results } = await env.DB.prepare(
      "SELECT * FROM experiments ORDER BY created_at DESC"
    ).all();
    return json({ ok: true, experiments: results }, {}, origin);
  }

  if (request.method === "POST" && url.pathname === "/api/experiments") {
    const body = await parseJson(request);
    if (!body?.dataset_id || !body?.experiment_name || !body?.problem_type || !body?.target_column) {
      return json({ ok: false, error: "Faltan campos requeridos" }, { status: 400 }, origin);
    }

    const result = await env.DB.prepare(
      `INSERT INTO experiments
       (dataset_id, experiment_name, problem_type, target_column, train_size, test_size, random_state)
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

    return json({ ok: true, experiment_id: result.meta.last_row_id }, { status: 201 }, origin);
  }

  if (request.method === "GET" && url.pathname.match(/^\/api\/experiments\/\d+\/runs$/)) {
    const id = Number(url.pathname.split("/")[3]);
    const { results } = await env.DB.prepare(
      "SELECT * FROM model_runs WHERE experiment_id = ? ORDER BY id DESC"
    )
      .bind(id)
      .all();

    return json({ ok: true, runs: results }, {}, origin);
  }

  return json({ ok: false, error: "Not found" }, { status: 404 }, origin);
};
