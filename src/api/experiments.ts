import { apiGet, apiPost } from "./client";

export const experimentsApi = {
  list: () => apiGet<{ ok: boolean; experiments: any[] }>("/api/experiments"),
  create: (payload: any) => apiPost<{ ok: boolean; experiment_id: number }>("/api/experiments", payload),
};
