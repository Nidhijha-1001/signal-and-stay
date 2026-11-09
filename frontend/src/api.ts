const API_BASE = import.meta.env.VITE_API_URL ?? "";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      message = body.detail ?? message;
    } catch {
      // The response may not be JSON when the API is unavailable.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}
