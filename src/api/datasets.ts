import { apiGet, apiPost } from "./client";

export const datasetsApi = {
  list: () => apiGet<{ ok: boolean; datasets: any[] }>("/api/datasets"),
  profile: (id: number) => apiGet<{ ok: boolean; dataset: any; columns: any[] }>(`/api/datasets/${id}/profile`),
  create: (payload: any) => apiPost<{ ok: boolean; dataset_id: number }>("/api/datasets", payload),
};
