import { apiPost } from "./client";

export const sqlApi = {
  execute: (query: string) => apiPost<{ ok: boolean; results: any[] }>("/api/sql/execute", { query }),
};
