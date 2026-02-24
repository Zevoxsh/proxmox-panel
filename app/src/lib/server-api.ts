import { cookies } from "next/headers";

const serverBaseUrl = process.env.API_BASE_URL || "http://server:4000";

async function buildCookieHeader() {
  const cookieStore = await cookies();
  const all = cookieStore.getAll();
  if (all.length === 0) return undefined;
  return all.map((c) => `${c.name}=${c.value}`).join("; ");
}

export async function serverFetch(path: string, init: RequestInit = {}) {
  const cookieHeader = await buildCookieHeader();
  const headers = new Headers(init.headers);
  if (cookieHeader) headers.set("Cookie", cookieHeader);
  return fetch(`${serverBaseUrl}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}
