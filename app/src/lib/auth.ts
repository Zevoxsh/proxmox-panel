import { cookies } from "next/headers";

export type SessionUser = {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  name?: string | null;
};

export type Session = { user: SessionUser };

const serverBaseUrl = process.env.API_BASE_URL || "http://server:4000";

export async function auth(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("pp_session")?.value;
  if (!token) return null;
  try {
    const res = await fetch(`${serverBaseUrl}/auth/me`, {
      headers: { Cookie: `pp_session=${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user: SessionUser };
    return { user: data.user };
  } catch {
    return null;
  }
}
