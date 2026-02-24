import { Router } from "express";
import bcrypt from "bcryptjs";
import { query } from "../db.js";
import { signJwt, requireAuth } from "../middleware/auth.js";

const router = Router();

function cookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  const secureEnv = process.env.COOKIE_SECURE;
  const secure = secureEnv ? secureEnv === "true" : isProd;
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 7,
  };
}

router.post("/register", async (req, res) => {
  const { email, password, name } = req.body as { email?: string; password?: string; name?: string };
  if (!email || !password) return res.status(400).json({ error: "Email et mot de passe requis" });
  const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rows.length > 0) return res.status(409).json({ error: "Email déjà utilisé" });

  const hash = await bcrypt.hash(password, 10);
  const insert = await query<{ id: string; role: string }>(
    "INSERT INTO users (email, password_hash, role, name) VALUES ($1,$2,'USER',$3) RETURNING id, role",
    [email, hash, name ?? null]
  );
  const user = insert.rows[0];
  const token = signJwt({ id: user.id, email, role: user.role as "USER" });
  res.cookie("pp_session", token, cookieOptions());
  return res.json({ ok: true });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ error: "Email et mot de passe requis" });

  const userRes = await query<{ id: string; email: string; password_hash: string; role: string; name: string | null }>(
    "SELECT id, email, password_hash, role, name FROM users WHERE email = $1",
    [email]
  );
  const user = userRes.rows[0];
  if (!user) return res.status(401).json({ error: "Identifiants invalides" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Identifiants invalides" });

  const token = signJwt({ id: user.id, email: user.email, role: user.role as "USER" | "ADMIN" });
  res.cookie("pp_session", token, cookieOptions());
  return res.json({ ok: true });
});

router.post("/logout", (_req, res) => {
  res.clearCookie("pp_session", { path: "/" });
  return res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  const userRes = await query<{ id: string; email: string; role: string; name: string | null }>(
    "SELECT id, email, role, name FROM users WHERE id = $1",
    [req.user!.id]
  );
  const user = userRes.rows[0];
  if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });
  return res.json({ user });
});

export default router;
