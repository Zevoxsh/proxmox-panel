import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { createProxmoxClient } from "../lib/proxmox.js";
import { createCheckoutSession, createOrRetrieveCustomer, createProductAndPrice } from "../lib/stripe.js";

const router = Router();
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.param("id", (req, res, next, id) => {
  if (!uuidRegex.test(id)) return res.status(400).json({ error: "Identifiant VM invalide" });
  return next();
});

const orderSchema = z.object({
  planId: z.string(),
  os: z.string().optional(),
  rootPassword: z.string().min(8).optional(),
});

function generateHostname(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 20) || "vm";
}

async function allocateVmid(proxmox: ReturnType<typeof createProxmoxClient>, min: number) {
  const [existingDb, clusterVmids] = await Promise.all([
    query<{ vmid: number }>("SELECT vmid FROM vms"),
    proxmox.getClusterVMIDs(),
  ]);
  const used = new Set<number>(clusterVmids);
  for (const v of existingDb.rows) used.add(Number(v.vmid));
  let candidate = min;
  while (used.has(candidate)) candidate += 1;
  return candidate;
}

async function pickBestNode() {
  const res = await query(`SELECT * FROM nodes WHERE is_active = true ORDER BY created_at ASC LIMIT 1`);
  return res.rows[0] ?? null;
}

router.get("/", requireAuth, async (req, res) => {
  const data = await query(
    `SELECT v.*, p.name AS plan_name, p.cpu AS plan_cpu, p.ram_mb AS plan_ram_mb, p.disk_gb AS plan_disk_gb, n.name AS node_name
     FROM vms v
     JOIN vm_plans p ON p.id = v.plan_id
     JOIN nodes n ON n.id = v.node_id
     WHERE v.user_id = $1
     ORDER BY v.created_at DESC`,
    [req.user!.id]
  );
  return res.json(data.rows.map((v) => ({
    id: v.id,
    vmid: v.vmid,
    name: v.name,
    status: v.status,
    type: v.type,
    ip: v.ip,
    os: v.os,
    plan: { name: v.plan_name, cpu: v.plan_cpu, ramMb: v.plan_ram_mb, diskGb: v.plan_disk_gb },
    node: { name: v.node_name },
  })));
});

router.get("/plans", requireAuth, async (_req, res) => {
  const plansRes = await query("SELECT * FROM vm_plans WHERE is_active = true ORDER BY price_monthly ASC");
  return res.json(plansRes.rows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    cpu: p.cpu,
    ramMb: p.ram_mb,
    diskGb: p.disk_gb,
    bandwidthGb: p.bandwidth_gb,
    priceMonthly: Number(p.price_monthly),
    type: p.type,
  })));
});

router.get("/:id", requireAuth, async (req, res) => {
  const vmRes = await query(
    `SELECT v.*, p.name AS plan_name, p.cpu AS plan_cpu, p.ram_mb AS plan_ram_mb, p.disk_gb AS plan_disk_gb,
            n.name AS node_name
     FROM vms v
     JOIN vm_plans p ON p.id = v.plan_id
     JOIN nodes n ON n.id = v.node_id
     WHERE v.id = $1`,
    [req.params.id]
  );
  const v = vmRes.rows[0];
  if (!v) return res.status(404).json({ error: "VM introuvable" });
  return res.json({
    id: v.id,
    vmid: v.vmid,
    name: v.name,
    status: v.status,
    type: v.type,
    ip: v.ip,
    os: v.os,
    sshPublicKey: v.ssh_public_key,
    createdAt: v.created_at,
    plan: { name: v.plan_name, cpu: v.plan_cpu, ramMb: v.plan_ram_mb, diskGb: v.plan_disk_gb },
    node: { name: v.node_name },
  });
});

router.post("/order", requireAuth, async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Données invalides" });
  const { planId, os, rootPassword } = parsed.data;

  const planRes = await query(
    "SELECT id, name, type, cpu, ram_mb, disk_gb, price_monthly, stripe_price_id FROM vm_plans WHERE id = $1 AND is_active = true",
    [planId]
  );
  const plan = planRes.rows[0];
  if (!plan) return res.status(404).json({ error: "Plan introuvable" });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey && !stripeKey.includes("placeholder")) {
    let priceId = plan.stripe_price_id as string | null;
    if (!priceId) {
      try {
        priceId = await createProductAndPrice(plan.name, Number(plan.price_monthly));
        await query("UPDATE vm_plans SET stripe_price_id = $1 WHERE id = $2", [priceId, plan.id]);
      } catch {
        return res.status(400).json({ error: "Impossible de créer le prix Stripe" });
      }
    }

    const userRes = await query("SELECT id, email, name, stripe_customer_id FROM users WHERE id = $1", [req.user!.id]);
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

    let customerId = user.stripe_customer_id;
    if (!customerId) {
      customerId = await createOrRetrieveCustomer(user.email, user.name);
      await query("UPDATE users SET stripe_customer_id = $1 WHERE id = $2", [customerId, user.id]);
    }

    const origin = req.headers.origin ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002";
    const url = await createCheckoutSession(customerId, priceId!, `${origin}/billing?success=true`, `${origin}/vms/new/${planId}`, {
      type: "VPS",
      planId,
      os: os ?? "",
      rootPassword: rootPassword ?? "",
      userId: req.user!.id,
    });
    return res.json({ checkoutUrl: url });
  }

  const node = await pickBestNode();
  if (!node) return res.status(503).json({ error: "Aucun nœud Proxmox actif" });

  try {
    const proxmox = createProxmoxClient({
      host: node.host,
      port: node.port,
      username: node.username,
      password: node.password,
      realm: node.realm,
      sslVerify: node.ssl_verify,
    });

    const vmid = await allocateVmid(proxmox, plan.type === "LXC" ? 5000 : 6000);
    const storage = node.template_storage || process.env.PROXMOX_STORAGE || "SAN1";

    if (plan.type === "LXC") {
      await proxmox.createLXC(node.name, {
        vmid,
        hostname: generateHostname(plan.name),
        ostemplate: os,
        cores: plan.cpu,
        memory: plan.ram_mb,
        rootfs: `${storage}:${plan.disk_gb}`,
        net0: "name=eth0,bridge=PUBLIC,ip=dhcp",
        start: true,
        password: rootPassword || undefined,
      });
    } else {
      const templateVmid = os ? Number(os) : 113;
      const upid = await proxmox.cloneKVMTemplate(node.name, templateVmid, {
        newid: vmid,
        name: generateHostname(plan.name),
        full: true,
        storage,
      });
      await proxmox.waitForTask(node.name, upid as string, 120000);
      await proxmox.setKVMConfig(node.name, vmid, {
        cores: plan.cpu,
        memory: plan.ram_mb,
        net0: "virtio,bridge=PUBLIC",
        ipconfig0: "ip=dhcp",
        ciuser: "root",
      });
      await proxmox.startVM(node.name, vmid);
    }

    const insert = await query(
      `INSERT INTO vms (vmid, name, type, status, os, user_id, node_id, plan_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [vmid, generateHostname(plan.name), plan.type, "RUNNING", os ?? null, req.user!.id, node.id, plan.id]
    );
    return res.json({ vmId: insert.rows[0].id });
  } catch {
    return res.status(500).json({ error: "Erreur provisioning" });
  }
});

export default router;
