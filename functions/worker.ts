export interface Env {
    const body = await parseJson(request);
    if (!body?.name || !body?.source_type) {
      return json({ ok: false, error: "Faltan campos requeridos" }, { status: 400, headers: corsHeaders(env.CORS_ORIGIN) });
    }

    const result = await env.DB.prepare(
      `INSERT INTO datasets (name, description, source_type, storage_key, preview_key, row_count, column_count, target_column)
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

    return json({ ok: true, dataset_id: result.meta.last_row_id }, { status: 201, headers: corsHeaders(env.CORS_ORIGIN) });
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/datasets/")) {
    const id = Number(url.pathname.split("/")[3]);
    await env.DB.prepare("DELETE FROM dataset_columns WHERE dataset_id = ?").bind(id).run();
    await env.DB.prepare("DELETE FROM datasets WHERE id = ?").bind(id).run();
    return json({ ok: true }, { headers: corsHeaders(env.CORS_ORIGIN) });
  }

  return null;
}

async function handleSql(request: Request, env: Env) {
  if (request.method !== "POST" || new URL(request.url).pathname !== "/api/sql/execute") return null;

  const body = await parseJson(request);
  if (!body?.query) {
    return json({ ok: false, error: "query es requerido" }, { status: 400, headers: corsHeaders(env.CORS_ORIGIN) });
  }

  try {
    const stmt = env.DB.prepare(body.query);
    const { results, meta } = await stmt.all();
    return json({ ok: true, results, meta }, { headers: corsHeaders(env.CORS_ORIGIN) });
  } catch (error: any) {
    return json(
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
      return json({ ok: false, error: "Faltan campos requeridos" }, { status: 400, header
