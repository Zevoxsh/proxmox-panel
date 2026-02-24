export function createPteroAppClient(baseUrl: string, apiKey: string) {
  const apiBase = baseUrl.replace(/\/$/, "");

  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${apiBase}/api/application${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Pterodactyl API ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  return {
    async createServer(payload: Record<string, unknown>) {
      return api("/servers", { method: "POST", body: JSON.stringify(payload) });
    },
  };
}
