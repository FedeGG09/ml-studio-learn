const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function buildUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path}`;
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();

  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
  }

  if (!res.ok) {
    const message =
      data?.error ||
      data?.message ||
      `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  return data as T;
}

export async function requestJson<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(buildUrl(path), init);
  return parseResponse<T>(res);
}

export async function apiGet<T>(path: string): Promise<T> {
  return requestJson<T>(path, {
    method: "GET",
  });
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function apiPostForm<T>(path: string, formData: FormData): Promise<T> {
  return requestJson<T>(path, {
    method: "POST",
    body: formData,
  });
}