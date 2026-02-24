import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { createProductAndPrice } from "../lib/stripe.js";
import { createProxmoxClient } from "../lib/proxmox.js";

const router = Router();

router.get("/users", requireAuth, requireAdmin, async (_req, res) => {
  const data = await query("SELECT id, email, role, name, created_at FROM users ORDER BY created_at DESC");
  return res.json(data.rows);
});

// Nodes
router.get("/nodes", requireAuth, requireAdmin, async (_req, res) => {
  const data = await query("SELECT * FROM nodes ORDER BY created_at DESC");
  return res.json(data.rows);
});

router.post("/nodes", requireAuth, requireAdmin, async (req, res) => {
  const { name, host, port, username, password, realm, sslVerify } = req.body;
  if (!name || !host || !username || !password) return res.status(400).json({ error: "Données invalides" });
  const insert = await query(
    `INSERT INTO nodes (name, host, port, username, password, realm, ssl_verify)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [name, host, port ?? 8006, username, password, realm ?? "pam", sslVerify ?? true]
  );
  return res.json(insert.rows[0]);
});

router.put("/nodes/:id", requireAuth, requireAdmin, async (req, res) => {
  const { name, host, port, username, password, realm, sslVerify, lxcTemplateDefault, kvmTemplateVmid, templateStorage, isActive } = req.body;
  const update = await query(
    `UPDATE nodes
     SET name = COALESCE($1,name),
         host = COALESCE($2,host),
         port = COALESCE($3,port),
         username = COALESCE($4,username),
         password = COALESCE($5,password),
         realm = COALESCE($6,realm),
         ssl_verify = COALESCE($7,ssl_verify),
         lxc_template_default = COALESCE($8,lxc_template_default),
         kvm_template_vmid = COALESCE($9,kvm_template_vmid),
         template_storage = COALESCE($10,template_storage),
         is_active = COALESCE($11,is_active)
     WHERE id = $12
     RETURNING *`,
    [name, host, port, username, password, realm, sslVerify, lxcTemplateDefault, kvmTemplateVmid, templateStorage, isActive, req.params.id]
  );
  return res.json(update.rows[0]);
});

router.get("/nodes/:id/templates", requireAuth, requireAdmin, async (req, res) => {
  const nodeRes = await query("SELECT * FROM nodes WHERE id = $1", [req.params.id]);
  const node = nodeRes.rows[0];
  if (!node) return res.status(404).json({ error: "Node introuvable" });
  try {
    const proxmox = createProxmoxClient({
      host: node.host,
      port: node.port,
      username: node.username,
      password: node.password,
      realm: node.realm,
      sslVerify: node.ssl_verify,
    });
    const storage = req.query.storage?.toString() || node.template_storage || process.env.PROXMOX_STORAGE || "SAN1";
    const lxcTemplates = await proxmox.getTemplates(node.name, storage);
    const qemuList = await proxmox.getQemuList(node.name);
    const kvmTemplates = qemuList.filter((v) => v.template === 1);
    return res.json({ storage, lxcTemplates, kvmTemplates });
  } catch (err) {
    return res.status(500).json({ error: "Impossible de charger les templates" });
  }
});

router.delete("/nodes/:id", requireAuth, requireAdmin, async (req, res) => {
  await query("DELETE FROM nodes WHERE id = $1", [req.params.id]);
  return res.json({ ok: true });
});

// VM Plans
router.get("/vm-plans", requireAuth, requireAdmin, async (_req, res) => {
  const data = await query("SELECT * FROM vm_plans ORDER BY created_at DESC");
  return res.json(data.rows);
});

router.post("/vm-plans", requireAuth, requireAdmin, async (req, res) => {
  const { name, description, cpu, ramMb, diskGb, bandwidthGb, priceMonthly, type } = req.body;
  if (!name || !cpu || !ramMb || !diskGb || !priceMonthly || !type) {
    return res.status(400).json({ error: "Données invalides" });
  }

  let stripePriceId: string | null = null;
  try {
    stripePriceId = await createProductAndPrice(name, Number(priceMonthly));
  } catch {
    stripePriceId = null;
  }

  const insert = await query(
    `INSERT INTO vm_plans (name, description, cpu, ram_mb, disk_gb, bandwidth_gb, price_monthly, type, stripe_price_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [name, description ?? null, cpu, ramMb, diskGb, bandwidthGb ?? null, priceMonthly, type, stripePriceId]
  );
  return res.json(insert.rows[0]);
});

router.delete("/vm-plans/:id", requireAuth, requireAdmin, async (req, res) => {
  await query("DELETE FROM vm_plans WHERE id = $1", [req.params.id]);
  return res.json({ ok: true });
});

// Game Plans
router.get("/game-plans", requireAuth, requireAdmin, async (_req, res) => {
  const data = await query("SELECT * FROM game_plans ORDER BY created_at DESC");
  return res.json(data.rows);
});

router.post("/game-plans", requireAuth, requireAdmin, async (req, res) => {
  const {
    name,
    description,
    game,
    cpu,
    ramMb,
    diskMb,
    databases,
    backups,
    priceMonthly,
    pteroEggId,
    pteroAllocationId,
    pteroDockerImage,
    pteroStartup,
    pteroEnvJson,
    pteroLimitsJson,
    pteroFeatureLimitsJson,
  } = req.body;

  if (!name || !game || !cpu || !ramMb || !diskMb || !priceMonthly) {
    return res.status(400).json({ error: "Données invalides" });
  }

  let stripePriceId: string | null = null;
  try {
    stripePriceId = await createProductAndPrice(name, Number(priceMonthly));
  } catch {
    stripePriceId = null;
  }

  const insert = await query(
    `INSERT INTO game_plans (name, description, game, cpu, ram_mb, disk_mb, databases, backups, price_monthly, stripe_price_id,
      ptero_egg_id, ptero_allocation_id, ptero_docker_image, ptero_startup, ptero_env_json, ptero_limits_json, ptero_feature_limits_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
    [
      name,
      description ?? null,
      game,
      cpu,
      ramMb,
      diskMb,
      databases ?? 0,
      backups ?? 0,
      priceMonthly,
      stripePriceId,
      pteroEggId ?? null,
      pteroAllocationId ?? null,
      pteroDockerImage ?? null,
      pteroStartup ?? null,
      pteroEnvJson ?? null,
      pteroLimitsJson ?? null,
      pteroFeatureLimitsJson ?? null,
    ]
  );
  return res.json(insert.rows[0]);
});

router.delete("/game-plans/:id", requireAuth, requireAdmin, async (req, res) => {
  await query("DELETE FROM game_plans WHERE id = $1", [req.params.id]);
  return res.json({ ok: true });
});

// Pterodactyl config (single)
router.get("/ptero", requireAuth, requireAdmin, async (_req, res) => {
  const data = await query("SELECT id, url, api_key FROM ptero_panels ORDER BY created_at DESC LIMIT 1");
  return res.json(data.rows[0] ?? null);
});

router.put("/ptero", requireAuth, requireAdmin, async (req, res) => {
  const { url, apiKey } = req.body as { url?: string; apiKey?: string };
  if (!url || !apiKey) return res.status(400).json({ error: "Données invalides" });
  await query("DELETE FROM ptero_panels");
  const insert = await query(
    "INSERT INTO ptero_panels (url, api_key) VALUES ($1,$2) RETURNING *",
    [url, apiKey]
  );
  return res.json(insert.rows[0]);
});

export default router;
