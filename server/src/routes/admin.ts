import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { createProxmoxClient } from "../lib/proxmox.js";
import { createPteroAppClient } from "../lib/pterodactyl.js";
import { createProductAndPrice } from "../lib/stripe.js";

const router = Router();

async function tryCreateStripePrice(name: string, priceMonthly: number) {
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes("placeholder")) {
    return null;
  }
  try {
    const timeoutMs = 5000;
    const priceId = await Promise.race([
      createProductAndPrice(name, priceMonthly),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    return priceId;
  } catch {
    return null;
  }
}

const nodeSchema = z.object({
  name: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(8006),
  username: z.string().min(1),
  password: z.string().min(1),
  realm: z.string().default("pam"),
  sslVerify: z.boolean().default(false),
});

const patchSchema = nodeSchema.partial();

function pickPreferredTemplate(
  templates: Array<{ volid?: string; name: string }>,
  preferred: string[]
): string | null {
  for (const pref of preferred) {
    const found = templates.find((t) => t.name.toLowerCase().includes(pref));
    if (found) return found.volid ?? found.name;
  }
  return templates[0]?.volid ?? templates[0]?.name ?? null;
}

router.get("/nodes", requireAuth, requireAdmin, async (_req, res) => {
  const result = await query<{
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    password: string;
    realm: string;
    ssl_verify: boolean;
    is_active: boolean;
    lxc_template_default: string | null;
    kvm_template_vmid: number | null;
    template_storage: string | null;
    vm_count: string;
  }>(
    `SELECT n.*, COUNT(v.id)::int AS vm_count
     FROM nodes n
     LEFT JOIN vms v ON v.node_id = n.id
     GROUP BY n.id
     ORDER BY n.name ASC`
  );

  const nodes = result.rows.map((n) => ({
    id: n.id,
    name: n.name,
    host: n.host,
    port: n.port,
    username: n.username,
    realm: n.realm,
    sslVerify: n.ssl_verify,
    isActive: n.is_active,
    lxcTemplateDefault: n.lxc_template_default,
    kvmTemplateVmid: n.kvm_template_vmid,
    templateStorage: n.template_storage,
    _count: { vms: Number(n.vm_count) },
  }));

  return res.json(nodes);
});

router.post("/nodes", requireAuth, requireAdmin, async (req, res) => {
  const parsed = nodeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Données invalides" });

  let reachable = false;
  let lxcTemplateDefault: string | null = null;
  let kvmTemplateVmid: number | null = null;
  let templateStorage: string | null = null;

  try {
    const proxmox = createProxmoxClient({
      host: parsed.data.host,
      port: parsed.data.port,
      username: parsed.data.username,
      password: parsed.data.password,
      realm: parsed.data.realm,
      sslVerify: parsed.data.sslVerify,
    });
    await proxmox.authenticate();
    reachable = true;

    const lxcTemplates = await proxmox.getTemplates(parsed.data.name);
    lxcTemplateDefault = pickPreferredTemplate(lxcTemplates, ["alpine", "ubuntu", "debian"]);
    templateStorage = lxcTemplateDefault?.split(":")[0] ?? null;

    kvmTemplateVmid = 113;
  } catch {
    // keep reachable false
  }

  const insert = await query<{ id: string }>(
    `INSERT INTO nodes
      (name, host, port, username, password, realm, ssl_verify, is_active, lxc_template_default, kvm_template_vmid, template_storage)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id`,
    [
      parsed.data.name,
      parsed.data.host,
      parsed.data.port,
      parsed.data.username,
      parsed.data.password,
      parsed.data.realm,
      parsed.data.sslVerify,
      reachable,
      lxcTemplateDefault,
      kvmTemplateVmid,
      templateStorage,
    ]
  );

  const id = insert.rows[0]?.id;
  const warning = reachable ? null : "Nœud sauvegardé mais injoignable pour l'instant";
  return res.status(201).json({ id, warning });
});

router.patch("/nodes/:id", requireAuth, requireAdmin, async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Données invalides" });

  const nodeRes = await query<{
    id: string;
    host: string;
    port: number;
    username: string;
    password: string;
    realm: string;
    ssl_verify: boolean;
  }>("SELECT * FROM nodes WHERE id = $1", [req.params.id]);

  const existing = nodeRes.rows[0];
  if (!existing) return res.status(404).json({ error: "Nœud introuvable" });

  const merged = {
    host: parsed.data.host ?? existing.host,
    port: parsed.data.port ?? existing.port,
    username: parsed.data.username ?? existing.username,
    password: parsed.data.password ?? existing.password,
    realm: parsed.data.realm ?? existing.realm,
    sslVerify: parsed.data.sslVerify ?? existing.ssl_verify,
  };

  let reachable = false;
  try {
    const proxmox = createProxmoxClient(merged);
    await proxmox.authenticate();
    reachable = true;
  } catch {
    // keep false
  }

  await query(
    `UPDATE nodes
     SET name = COALESCE($1, name),
         host = COALESCE($2, host),
         port = COALESCE($3, port),
         username = COALESCE($4, username),
         password = COALESCE($5, password),
         realm = COALESCE($6, realm),
         ssl_verify = COALESCE($7, ssl_verify),
         is_active = $8
     WHERE id = $9`,
    [
      parsed.data.name ?? null,
      parsed.data.host ?? null,
      parsed.data.port ?? null,
      parsed.data.username ?? null,
      parsed.data.password ?? null,
      parsed.data.realm ?? null,
      parsed.data.sslVerify ?? null,
      reachable,
      req.params.id,
    ]
  );

  return res.json({
    ok: true,
    warning: reachable ? null : "Nœud mis à jour mais toujours injoignable",
  });
});

router.delete("/nodes/:id", requireAuth, requireAdmin, async (req, res) => {
  const vmCountRes = await query<{ count: string }>("SELECT COUNT(*)::int AS count FROM vms WHERE node_id = $1", [req.params.id]);
  const count = Number(vmCountRes.rows[0]?.count ?? 0);
  if (count > 0) {
    return res.status(409).json({ error: `Ce nœud héberge ${count} VM(s). Supprimez-les d'abord.` });
  }

  await query("DELETE FROM nodes WHERE id = $1", [req.params.id]);
  return res.json({ ok: true });
});

router.post("/nodes/:id/sync", requireAuth, requireAdmin, async (req, res) => {
  const nodeRes = await query<{
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    password: string;
    realm: string;
    ssl_verify: boolean;
  }>("SELECT * FROM nodes WHERE id = $1", [req.params.id]);

  const node = nodeRes.rows[0];
  if (!node) return res.status(404).json({ error: "Nœud introuvable" });

  try {
    const proxmox = createProxmoxClient({
      host: node.host,
      port: node.port,
      username: node.username,
      password: node.password,
      realm: node.realm,
      sslVerify: node.ssl_verify,
    });
    await proxmox.authenticate();

    const lxcTemplates = await proxmox.getTemplates(node.name);
    const lxcTemplateDefault = pickPreferredTemplate(lxcTemplates, ["alpine", "ubuntu", "debian"]);
    const templateStorage = lxcTemplateDefault?.split(":")[0] ?? null;
    const kvmTemplateVmid = 113;

    await query(
      `UPDATE nodes
       SET lxc_template_default = $1,
           kvm_template_vmid = $2,
           template_storage = $3,
           is_active = true
       WHERE id = $4`,
      [lxcTemplateDefault, kvmTemplateVmid, templateStorage, req.params.id]
    );

    return res.json({
      ok: true,
      warning: lxcTemplates.length === 0 ? "Aucun template LXC détecté." : null,
    });
  } catch {
    return res.status(502).json({ error: "Impossible de synchroniser les templates (Proxmox injoignable)" });
  }
});

const panelSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  apiKey: z.string().min(10),
});

router.get("/ptero/panels", requireAuth, requireAdmin, async (_req, res) => {
  const result = await query<{
    id: string;
    name: string;
    url: string;
    api_key: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    server_count: string;
    plan_count: string;
  }>(
    `SELECT p.*,
            COUNT(DISTINCT s.id)::int AS server_count,
            COUNT(DISTINCT g.id)::int AS plan_count
     FROM ptero_panels p
     LEFT JOIN game_servers s ON s.panel_id = p.id
     LEFT JOIN game_plans g ON g.panel_id = p.id
     GROUP BY p.id
     ORDER BY p.name ASC`
  );

  const panels = result.rows.map((p) => ({
    id: p.id,
    name: p.name,
    url: p.url,
    isActive: p.is_active,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    _count: { servers: Number(p.server_count), gamePlans: Number(p.plan_count) },
  }));

  return res.json(panels);
});

router.post("/ptero/panels", requireAuth, requireAdmin, async (req, res) => {
  const parsed = panelSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Données invalides" });

  const ptero = createPteroAppClient(parsed.data.url, parsed.data.apiKey);
  const ok = await ptero.ping();
  if (!ok) return res.status(400).json({ error: "Impossible de se connecter au panel Pterodactyl" });

  const insert = await query<{ id: string }>(
    `INSERT INTO ptero_panels (name, url, api_key)
     VALUES ($1,$2,$3) RETURNING id`,
    [parsed.data.name, parsed.data.url, parsed.data.apiKey]
  );

  return res.status(201).json({ id: insert.rows[0]?.id });
});

router.get("/ptero/eggs", requireAuth, requireAdmin, async (req, res) => {
  const panelId = String(req.query.panelId || "");
  const nestId = req.query.nestId ? Number(req.query.nestId) : null;

  if (!panelId) return res.status(400).json({ error: "panelId requis" });

  const panelRes = await query<{ id: string; url: string; api_key: string }>(
    "SELECT id, url, api_key FROM ptero_panels WHERE id = $1",
    [panelId]
  );
  const panel = panelRes.rows[0];
  if (!panel) return res.status(404).json({ error: "Panel introuvable" });

  const ptero = createPteroAppClient(panel.url, panel.api_key);
  if (nestId) {
    const eggs = await ptero.listEggs(nestId);
    return res.json(eggs);
  }
  const nests = await ptero.listNests();
  return res.json(nests);
});

const gamePlanSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  game: z.string().min(1),
  cpu: z.number().int().min(1),
  ramMb: z.number().int().min(128),
  diskMb: z.number().int().min(512),
  databases: z.number().int().min(0).default(1),
  backups: z.number().int().min(0).default(2),
  allocations: z.number().int().min(1).default(1),
  priceMonthly: z.number().min(0),
  stripePriceId: z.string().optional(),
  nestId: z.number().int(),
  eggId: z.number().int(),
  dockerImage: z.string().min(1),
  startup: z.string().min(1),
  envVars: z.record(z.string()).optional(),
  panelId: z.string(),
});

const vmPlanSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  cpu: z.number().int().min(1),
  ramMb: z.number().int().min(256),
  diskGb: z.number().int().min(5),
  bandwidthGb: z.number().int().min(0).optional(),
  priceMonthly: z.number().min(0),
  stripePriceId: z.string().optional(),
  type: z.enum(["LXC", "KVM"]),
  isActive: z.boolean().optional(),
});

router.get("/vm-plans", requireAuth, requireAdmin, async (_req, res) => {
  const result = await query<{
    id: string;
    name: string;
    description: string | null;
    cpu: number;
    ram_mb: number;
    disk_gb: number;
    bandwidth_gb: number | null;
    price_monthly: string;
    stripe_price_id: string | null;
    is_active: boolean;
    type: string;
    vm_count: string;
  }>(
    `SELECT p.*, COUNT(v.id)::int AS vm_count
     FROM vm_plans p
     LEFT JOIN vms v ON v.plan_id = p.id
     GROUP BY p.id
     ORDER BY p.type ASC, p.price_monthly ASC`
  );

  const plans = result.rows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    cpu: p.cpu,
    ramMb: p.ram_mb,
    diskGb: p.disk_gb,
    bandwidthGb: p.bandwidth_gb,
    priceMonthly: Number(p.price_monthly),
    stripePriceId: p.stripe_price_id,
    isActive: p.is_active,
    type: p.type,
    _count: { vms: Number(p.vm_count) },
  }));

  return res.json(plans);
});


router.get("/game-plans", requireAuth, requireAdmin, async (_req, res) => {
  const result = await query<{
    id: string;
    name: string;
    description: string | null;
    game: string;
    cpu: number;
    ram_mb: number;
    disk_mb: number;
    databases: number;
    backups: number;
    allocations: number;
    price_monthly: string;
    stripe_price_id: string | null;
    nest_id: number;
    egg_id: number;
    docker_image: string;
    startup: string;
    env_vars: unknown;
    is_active: boolean;
    panel_id: string;
    panel_name: string;
    server_count: string;
  }>(
    `SELECT g.*,
            p.name AS panel_name,
            COUNT(s.id)::int AS server_count
     FROM game_plans g
     JOIN ptero_panels p ON p.id = g.panel_id
     LEFT JOIN game_servers s ON s.plan_id = g.id
     GROUP BY g.id, p.name
     ORDER BY g.game ASC, g.price_monthly ASC`
  );

  const plans = result.rows.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    game: g.game,
    cpu: g.cpu,
    ramMb: g.ram_mb,
    diskMb: g.disk_mb,
    databases: g.databases,
    backups: g.backups,
    allocations: g.allocations,
    priceMonthly: Number(g.price_monthly),
    stripePriceId: g.stripe_price_id,
    nestId: g.nest_id,
    eggId: g.egg_id,
    dockerImage: g.docker_image,
    startup: g.startup,
    envVars: g.env_vars ?? {},
    isActive: g.is_active,
    panel: { id: g.panel_id, name: g.panel_name },
    _count: { servers: Number(g.server_count) },
  }));

  return res.json(plans);
});

router.post("/game-plans", requireAuth, requireAdmin, async (req, res) => {
  const parsed = gamePlanSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Données invalides" });

  const panelRes = await query<{ id: string }>("SELECT id FROM ptero_panels WHERE id = $1", [parsed.data.panelId]);
  if (panelRes.rowCount === 0) return res.status(404).json({ error: "Panel introuvable" });

  const stripePriceId = await tryCreateStripePrice(parsed.data.name, parsed.data.priceMonthly);

  const insert = await query<{ id: string }>(
    `INSERT INTO game_plans
     (name, description, game, cpu, ram_mb, disk_mb, databases, backups, allocations, price_monthly,
      stripe_price_id, nest_id, egg_id, docker_image, startup, env_vars, panel_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     RETURNING id`,
    [
      parsed.data.name,
      parsed.data.description ?? null,
      parsed.data.game,
      parsed.data.cpu,
      parsed.data.ramMb,
      parsed.data.diskMb,
      parsed.data.databases,
      parsed.data.backups,
      parsed.data.allocations,
      parsed.data.priceMonthly,
      stripePriceId,
      parsed.data.nestId,
      parsed.data.eggId,
      parsed.data.dockerImage,
      parsed.data.startup,
      parsed.data.envVars ?? {},
      parsed.data.panelId,
    ]
  );

  return res.status(201).json({ id: insert.rows[0]?.id });
});

router.post("/vm-plans", requireAuth, requireAdmin, async (req, res) => {
  const parsed = vmPlanSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Données invalides" });

  const stripePriceId = await tryCreateStripePrice(parsed.data.name, parsed.data.priceMonthly);

  const insert = await query<{ id: string }>(
    `INSERT INTO vm_plans
     (name, description, cpu, ram_mb, disk_gb, bandwidth_gb, price_monthly, stripe_price_id, type, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id`,
    [
      parsed.data.name,
      parsed.data.description ?? null,
      parsed.data.cpu,
      parsed.data.ramMb,
      parsed.data.diskGb,
      parsed.data.bandwidthGb ?? null,
      parsed.data.priceMonthly,
      stripePriceId,
      parsed.data.type,
      parsed.data.isActive ?? true,
    ]
  );

  return res.status(201).json({ id: insert.rows[0]?.id });
});

router.get("/users", requireAuth, requireAdmin, async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const offset = (page - 1) * limit;

  const usersRes = await query<{
    id: string;
    email: string;
    name: string | null;
    role: "USER" | "ADMIN";
    created_at: string;
    stripe_customer_id: string | null;
    vm_count: string;
    sub_count: string;
  }>(
    `SELECT u.*,
            COUNT(DISTINCT v.id)::int AS vm_count,
            COUNT(DISTINCT s.id)::int AS sub_count
     FROM users u
     LEFT JOIN vms v ON v.user_id = u.id
     LEFT JOIN subscriptions s ON s.user_id = u.id
     GROUP BY u.id
     ORDER BY u.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  const totalRes = await query<{ count: string }>("SELECT COUNT(*)::int AS count FROM users");
  const total = Number(totalRes.rows[0]?.count ?? 0);

  const users = usersRes.rows.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.created_at,
    stripeCustomerId: u.stripe_customer_id,
    _count: { vms: Number(u.vm_count), subscriptions: Number(u.sub_count) },
  }));

  return res.json({ users, total, page, limit });
});

router.get("/ptero/overview", requireAuth, requireAdmin, async (_req, res) => {
  const [panelsRes, totalServersRes, runningRes, recentServersRes, gamePlansRes] = await Promise.all([
    query<{
      id: string;
      name: string;
      url: string;
      is_active: boolean;
      server_count: string;
      plan_count: string;
    }>(
      `SELECT p.id, p.name, p.url, p.is_active,
              COUNT(DISTINCT s.id)::int AS server_count,
              COUNT(DISTINCT g.id)::int AS plan_count
       FROM ptero_panels p
       LEFT JOIN game_servers s ON s.panel_id = p.id
       LEFT JOIN game_plans g ON g.panel_id = p.id
       GROUP BY p.id
       ORDER BY p.name ASC`
    ),
    query<{ count: string }>("SELECT COUNT(*)::int AS count FROM game_servers"),
    query<{ count: string }>("SELECT COUNT(*)::int AS count FROM game_servers WHERE status = 'RUNNING'"),
    query<{
      id: string;
      name: string;
      status: string;
      created_at: string;
      plan_name: string;
      plan_game: string;
      user_email: string;
      user_name: string | null;
    }>(
      `SELECT g.id, g.name, g.status, g.created_at,
              p.name AS plan_name, p.game AS plan_game,
              u.email AS user_email, u.name AS user_name
       FROM game_servers g
       JOIN game_plans p ON p.id = g.plan_id
       JOIN users u ON u.id = g.user_id
       ORDER BY g.created_at DESC
       LIMIT 8`
    ),
    query<{ count: string }>("SELECT COUNT(*)::int AS count FROM game_plans WHERE is_active = true"),
  ]);

  const panels = panelsRes.rows.map((p) => ({
    id: p.id,
    name: p.name,
    url: p.url,
    isActive: p.is_active,
    _count: { servers: Number(p.server_count), gamePlans: Number(p.plan_count) },
  }));

  const recentServers = recentServersRes.rows.map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status,
    createdAt: s.created_at,
    plan: { name: s.plan_name, game: s.plan_game },
    user: { email: s.user_email, name: s.user_name },
  }));

  return res.json({
    panels,
    totalServers: Number(totalServersRes.rows[0]?.count ?? 0),
    running: Number(runningRes.rows[0]?.count ?? 0),
    gamePlans: Number(gamePlansRes.rows[0]?.count ?? 0),
    recentServers,
  });
});

router.get("/overview", requireAuth, requireAdmin, async (_req, res) => {
  const [
    usersRes,
    vmsRes,
    runningRes,
    revenueRes,
    recentUsersRes,
    recentVmsRes,
  ] = await Promise.all([
    query<{ count: string }>("SELECT COUNT(*)::int AS count FROM users"),
    query<{ count: string }>("SELECT COUNT(*)::int AS count FROM vms"),
    query<{ count: string }>("SELECT COUNT(*)::int AS count FROM vms WHERE status = 'RUNNING'"),
    query<{ amount: string | null }>(
      "SELECT COALESCE(SUM(amount), 0)::numeric AS amount FROM invoices WHERE status = 'PAID'"
    ),
    query<{
      id: string;
      email: string;
      name: string | null;
      role: "USER" | "ADMIN";
      created_at: string;
      vm_count: string;
    }>(
      `SELECT u.*,
              COUNT(v.id)::int AS vm_count
       FROM users u
       LEFT JOIN vms v ON v.user_id = u.id
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT 5`
    ),
    query<{
      id: string;
      name: string;
      status: string;
      vmid: number;
      type: string;
      created_at: string;
      user_email: string;
      node_name: string;
      plan_name: string;
    }>(
      `SELECT v.id, v.name, v.status, v.vmid, v.type, v.created_at,
              u.email AS user_email,
              n.name AS node_name,
              p.name AS plan_name
       FROM vms v
       JOIN users u ON u.id = v.user_id
       JOIN nodes n ON n.id = v.node_id
       JOIN vm_plans p ON p.id = v.plan_id
       ORDER BY v.created_at DESC
       LIMIT 5`
    ),
  ]);

  const recentUsers = recentUsersRes.rows.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.created_at,
    _count: { vms: Number(u.vm_count) },
  }));

  const recentVMs = recentVmsRes.rows.map((v) => ({
    id: v.id,
    name: v.name,
    status: v.status,
    vmid: v.vmid,
    type: v.type,
    createdAt: v.created_at,
    user: { email: v.user_email },
    node: { name: v.node_name },
    plan: { name: v.plan_name },
  }));

  return res.json({
    totalUsers: Number(usersRes.rows[0]?.count ?? 0),
    totalVMs: Number(vmsRes.rows[0]?.count ?? 0),
    runningVMs: Number(runningRes.rows[0]?.count ?? 0),
    totalRevenue: Number(revenueRes.rows[0]?.amount ?? 0),
    recentUsers,
    recentVMs,
  });
});

router.get("/vms", requireAuth, requireAdmin, async (_req, res) => {
  const vmsRes = await query<{
    id: string;
    name: string;
    status: string;
    vmid: number;
    type: string;
    created_at: string;
    user_name: string | null;
    user_email: string;
    node_name: string;
    plan_name: string;
  }>(
    `SELECT v.id, v.name, v.status, v.vmid, v.type, v.created_at,
            u.name AS user_name, u.email AS user_email,
            n.name AS node_name,
            p.name AS plan_name
     FROM vms v
     JOIN users u ON u.id = v.user_id
     JOIN nodes n ON n.id = v.node_id
     JOIN vm_plans p ON p.id = v.plan_id
     ORDER BY v.created_at DESC`
  );

  const statsRes = await query<{ status: string; count: string }>(
    "SELECT status, COUNT(*)::int AS count FROM vms GROUP BY status"
  );

  const vms = vmsRes.rows.map((v) => ({
    id: v.id,
    name: v.name,
    status: v.status,
    vmid: v.vmid,
    type: v.type,
    createdAt: v.created_at,
    user: { name: v.user_name, email: v.user_email },
    node: { name: v.node_name },
    plan: { name: v.plan_name },
  }));

  const stats = statsRes.rows.map((s) => ({ status: s.status, count: Number(s.count) }));
  return res.json({ vms, stats });
});

export default router;
