import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { createPteroAppClient, mapPteroStatus } from "../lib/pterodactyl.js";

const router = Router();

const createSchema = z.object({
  planId: z.string(),
  name: z.string().min(2).max(32).regex(/^[a-zA-Z0-9 _-]+$/),
});

const powerSchema = z.object({
  action: z.enum(["start", "stop", "restart", "kill"]),
});

router.get("/", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const isAdmin = req.user!.role === "ADMIN";

  const serversRes = await query<{
    id: string;
    name: string;
    status: string;
    ptero_uuid: string;
    ptero_id: number;
    identifier: string;
    ptero_user_id: number;
    plan_id: string;
    plan_name: string;
    plan_game: string;
    plan_cpu: number;
    plan_ram_mb: number;
    plan_disk_mb: number;
    panel_id: string;
    panel_name: string;
    panel_url: string;
    user_id: string;
    user_email: string;
    user_name: string | null;
  }>(
    `SELECT g.*, 
            p.name AS plan_name, p.game AS plan_game, p.cpu AS plan_cpu, p.ram_mb AS plan_ram_mb, p.disk_mb AS plan_disk_mb,
            pa.name AS panel_name, pa.url AS panel_url,
            u.email AS user_email, u.name AS user_name
     FROM game_servers g
     JOIN game_plans p ON p.id = g.plan_id
     JOIN ptero_panels pa ON pa.id = g.panel_id
     JOIN users u ON u.id = g.user_id
     WHERE ${isAdmin ? "TRUE" : "g.user_id = $1"}
     ORDER BY g.created_at DESC`,
    isAdmin ? [] : [userId]
  );

  const servers = serversRes.rows.map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status,
    pteroUuid: s.ptero_uuid,
    pteroId: s.ptero_id,
    identifier: s.identifier,
    pteroUserId: s.ptero_user_id,
    plan: { name: s.plan_name, game: s.plan_game, cpu: s.plan_cpu, ramMb: s.plan_ram_mb, diskMb: s.plan_disk_mb },
    panel: { id: s.panel_id, name: s.panel_name, url: s.panel_url },
    user: { id: s.user_id, email: s.user_email, name: s.user_name },
  }));

  return res.json(servers);
});

router.get("/plans", requireAuth, async (_req, res) => {
  const plansRes = await query<{
    id: string;
    name: string;
    description: string | null;
    game: string;
    cpu: number;
    ram_mb: number;
    disk_mb: number;
    egg_id: number;
    databases: number;
    backups: number;
    allocations: number;
    price_monthly: string;
    panel_id: string;
    panel_name: string;
  }>(
    `SELECT g.*, p.name AS panel_name
     FROM game_plans g
     JOIN ptero_panels p ON p.id = g.panel_id
     WHERE g.is_active = true
     ORDER BY g.game ASC, g.price_monthly ASC`
  );

  const plans = plansRes.rows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    game: p.game,
    cpu: p.cpu,
    ramMb: p.ram_mb,
    diskMb: p.disk_mb,
    databases: p.databases,
    backups: p.backups,
    allocations: p.allocations,
    priceMonthly: Number(p.price_monthly),
    panel: { name: p.panel_name },
  }));

  return res.json(plans);
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Données invalides" });

  const { planId, name } = parsed.data;

  const planRes = await query<{
    id: string;
    name: string;
    game: string;
    cpu: number;
    ram_mb: number;
    disk_mb: number;
    databases: number;
    backups: number;
    allocations: number;
    docker_image: string;
    startup: string;
    env_vars: unknown;
    egg_id: number;
    panel_id: string;
    panel_url: string;
    panel_api_key: string;
  }>(
    `SELECT g.*, p.url AS panel_url, p.api_key AS panel_api_key
     FROM game_plans g
     JOIN ptero_panels p ON p.id = g.panel_id
     WHERE g.id = $1 AND g.is_active = true`,
    [planId]
  );

  const plan = planRes.rows[0];
  if (!plan) return res.status(404).json({ error: "Plan introuvable" });

  const userRes = await query<{ id: string; email: string; name: string | null }>(
    "SELECT id, email, name FROM users WHERE id = $1",
    [req.user!.id]
  );
  const user = userRes.rows[0];
  if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

  try {
    const ptero = createPteroAppClient(plan.panel_url, plan.panel_api_key);
    const username = user.email.split("@")[0];
    const pteroUser = await ptero.findOrCreateUser(user.email, username, user.name ?? username);

    const envVars = (plan.env_vars as Record<string, string> | null) ?? {};

    const server = await ptero.createServer({
      name,
      user: pteroUser.id,
      egg: plan.egg_id,
      docker_image: plan.docker_image,
      startup: plan.startup,
      environment: envVars,
      limits: { memory: plan.ram_mb, disk: plan.disk_mb, cpu: plan.cpu, swap: 0, io: 500 },
      feature_limits: { databases: plan.databases, backups: plan.backups, allocations: plan.allocations },
      deploy: { locations: [1], dedicated_ip: false, port_range: [] },
    });

    const insert = await query<{ id: string }>(
      `INSERT INTO game_servers
       (ptero_uuid, ptero_id, identifier, name, status, ptero_user_id, user_id, panel_id, plan_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        server.uuid,
        server.id,
        server.identifier,
        name,
        "INSTALLING",
        pteroUser.id,
        req.user!.id,
        plan.panel_id,
        plan.id,
      ]
    );

    return res.status(201).json({ id: insert.rows[0]?.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    return res.status(500).json({ error: `Erreur lors de la création: ${msg}` });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const isAdmin = req.user!.role === "ADMIN";

  const serverRes = await query<{
    id: string;
    name: string;
    status: string;
    ptero_uuid: string;
    ptero_id: number;
    identifier: string;
    ptero_user_id: number;
    plan_id: string;
    plan_name: string;
    plan_game: string;
    plan_cpu: number;
    plan_ram_mb: number;
    plan_disk_mb: number;
    panel_id: string;
    panel_name: string;
    panel_url: string;
    panel_api_key: string;
    user_id: string;
    user_email: string;
    user_name: string | null;
  }>(
    `SELECT g.*, 
            p.name AS plan_name, p.game AS plan_game, p.cpu AS plan_cpu, p.ram_mb AS plan_ram_mb, p.disk_mb AS plan_disk_mb,
            pa.name AS panel_name, pa.url AS panel_url, pa.api_key AS panel_api_key,
            u.email AS user_email, u.name AS user_name
     FROM game_servers g
     JOIN game_plans p ON p.id = g.plan_id
     JOIN ptero_panels pa ON pa.id = g.panel_id
     JOIN users u ON u.id = g.user_id
     WHERE g.id = $1 AND ${isAdmin ? "TRUE" : "g.user_id = $2"}
     LIMIT 1`,
    isAdmin ? [req.params.id] : [req.params.id, userId]
  );

  const s = serverRes.rows[0];
  if (!s) return res.status(404).json({ error: "Serveur introuvable" });

  return res.json({
    id: s.id,
    name: s.name,
    status: s.status,
    pteroUuid: s.ptero_uuid,
    pteroId: s.ptero_id,
    identifier: s.identifier,
    pteroUserId: s.ptero_user_id,
    plan: { name: s.plan_name, game: s.plan_game, cpu: s.plan_cpu, ramMb: s.plan_ram_mb, diskMb: s.plan_disk_mb },
    panel: { id: s.panel_id, name: s.panel_name, url: s.panel_url },
    user: { id: s.user_id, email: s.user_email, name: s.user_name },
  });
});

router.delete("/:id", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const isAdmin = req.user!.role === "ADMIN";

  const serverRes = await query<{
    id: string;
    ptero_id: number;
    panel_url: string;
    panel_api_key: string;
  }>(
    `SELECT g.id, g.ptero_id, pa.url AS panel_url, pa.api_key AS panel_api_key
     FROM game_servers g
     JOIN ptero_panels pa ON pa.id = g.panel_id
     WHERE g.id = $1 AND ${isAdmin ? "TRUE" : "g.user_id = $2"}
     LIMIT 1`,
    isAdmin ? [req.params.id] : [req.params.id, userId]
  );

  const s = serverRes.rows[0];
  if (!s) return res.status(404).json({ error: "Serveur introuvable" });

  try {
    const ptero = createPteroAppClient(s.panel_url, s.panel_api_key);
    await ptero.deleteServer(s.ptero_id, true);
    await query("DELETE FROM game_servers WHERE id = $1", [s.id]);
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

router.get("/:id/resources", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const isAdmin = req.user!.role === "ADMIN";

  const serverRes = await query<{
    id: string;
    status: string;
    ptero_id: number;
    panel_url: string;
    panel_api_key: string;
  }>(
    `SELECT g.id, g.status, g.ptero_id, pa.url AS panel_url, pa.api_key AS panel_api_key
     FROM game_servers g
     JOIN ptero_panels pa ON pa.id = g.panel_id
     WHERE g.id = $1 AND ${isAdmin ? "TRUE" : "g.user_id = $2"}
     LIMIT 1`,
    isAdmin ? [req.params.id] : [req.params.id, userId]
  );

  const s = serverRes.rows[0];
  if (!s) return res.status(404).json({ error: "Serveur introuvable" });

  try {
    const ptero = createPteroAppClient(s.panel_url, s.panel_api_key);
    const pteroServer = await ptero.getServer(s.ptero_id);

    const mappedStatus = mapPteroStatus(pteroServer.status);
    if (s.status !== mappedStatus) {
      await query("UPDATE game_servers SET status = $1 WHERE id = $2", [mappedStatus, s.id]);
    }

    return res.json({
      status: mappedStatus,
      pteroStatus: pteroServer.status,
      allocation: pteroServer.allocation,
      limits: pteroServer.limits,
    });
  } catch {
    return res.json({ status: s.status, error: "Panel inaccessible" });
  }
});

router.post("/:id/power", requireAuth, async (req, res) => {
  const parsed = powerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Action invalide" });

  const userId = req.user!.id;
  const isAdmin = req.user!.role === "ADMIN";

  const serverRes = await query<{
    id: string;
    ptero_id: number;
    panel_url: string;
    panel_api_key: string;
  }>(
    `SELECT g.id, g.ptero_id, pa.url AS panel_url, pa.api_key AS panel_api_key
     FROM game_servers g
     JOIN ptero_panels pa ON pa.id = g.panel_id
     WHERE g.id = $1 AND ${isAdmin ? "TRUE" : "g.user_id = $2"}
     LIMIT 1`,
    isAdmin ? [req.params.id] : [req.params.id, userId]
  );

  const s = serverRes.rows[0];
  if (!s) return res.status(404).json({ error: "Serveur introuvable" });

  try {
    const ptero = createPteroAppClient(s.panel_url, s.panel_api_key);

    if (parsed.data.action === "stop") {
      await ptero.suspendServer(s.ptero_id);
      await query("UPDATE game_servers SET status = 'STOPPED' WHERE id = $1", [s.id]);
    } else if (parsed.data.action === "start") {
      await ptero.unsuspendServer(s.ptero_id);
      await query("UPDATE game_servers SET status = 'RUNNING' WHERE id = $1", [s.id]);
    } else if (parsed.data.action === "restart") {
      await ptero.unsuspendServer(s.ptero_id);
      await query("UPDATE game_servers SET status = 'RUNNING' WHERE id = $1", [s.id]);
    }

    return res.json({ success: true, action: parsed.data.action });
  } catch {
    return res.status(500).json({ error: "Erreur lors de l'action" });
  }
});

export default router;
