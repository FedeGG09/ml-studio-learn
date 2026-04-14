export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  });
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === "/api/health") {
      return json({ ok: true, service: "ml-studio" });
    }

    if (pathname === "/api/datasets" && request.method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM datasets ORDER BY created_at DESC"
      ).all();
      return json({ ok: true, datasets: results });
    }

    if (pathname === "/api/datasets" && request.method === "POST") {
      const body = await readJson(request);
      if (!body?.name || !body?.source_type) {
        return json({ ok: false, error: "Faltan campos requeridos" }, { status: 400 });
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
          body.target_column ?? null
        )
        .run();

      return json({ ok: true, dataset_id: result.meta.last_row_id }, { status: 201 });
    }

    if (pathname === "/api/sql/execute" && request.method === "POST") {
      const body = await readJson(request);
      if (!body?.query) {
        return json({ ok: false, error: "query es requerido" }, { status: 400 });
      }

      try {
        const { results, meta } = await env.DB.prepare(body.query).all();
        return json({ ok: true, results, meta });
      } catch (error: any) {
        return json(
          { ok: false, error: error?.message ?? "Error ejecutando SQL" },
          { status: 400 }
        );
      }
    }

    if (pathname === "/api/experiments" && request.method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM experiments ORDER BY created_at DESC"
      ).all();
      return json({ ok: true, experiments: results });
    }

    if (pathname === "/api/experiments" && request.method === "POST") {
      const body = await readJson(request);
      if (!body?.dataset_id || !body?.experiment_name || !body?.problem_type || !body?.target_column) {
        return json({ ok: false, error: "Faltan campos requeridos" }, { status: 400 });
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
          body.random_state ?? 42
        )
        .run();

      return json({ ok: true, experiment_id: result.meta.last_row_id }, { status: 201 });
    }

    return env.ASSETS.fetch(request);
  },
};
