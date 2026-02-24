import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { query } from "../db.js";
import { requireAuth, signJwt } from "../middleware/auth.js";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8),
});

function setAuthCookie(res: any, token: string) {
  const secureEnv = process.env.COOKIE_SECURE;
  const isProd = process.env.NODE_ENV === "production";
  const isSecure = secureEnv ? secureEnv === "true" : isProd;
  res.cookie("pp_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
}

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });
  const { email, password } = parsed.data;

  const result = await query<{ id: string; email: string; password: string; role: "USER" | "ADMIN" }>(
    "SELECT id, email, password, role FROM users WHERE email = $1",
    [email]
  );
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signJwt({ id: user.id, email: user.email, role: user.role });
  setAuthCookie(res, token);
  return res.json({ ok: true });
});

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });
  const { name, email, password } = parsed.data;

  const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rowCount) return res.status(409).json({ error: "Email already used" });

  const hash = await bcrypt.hash(password, 10);
  await query(
    "INSERT INTO users (email, password, name) VALUES ($1, $2, $3)",
    [email, hash, name]
  );

  return res.status(201).json({ ok: true });
});

router.post("/logout", (req, res) => {
  res.clearCookie("pp_session", { path: "/" });
  return res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  return res.json({ user: req.user });
});

export default router;
