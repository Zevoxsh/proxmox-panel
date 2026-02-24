import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { createProxmoxClient } from "../lib/proxmox.js";

const router = Router();
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.param("id", (req, res, next, id) => {
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ error: "Identifiant VM invalide" });
  }
  return next();
});

const createSchema = z.object({
  planId: z.string(),
  name: z.string().min(2).max(32).regex(/^[a-zA-Z0-9-]+$/),
  os: z.string().optional(),
  type: z.enum(["LXC", "KVM"]),
  nodeId: z.string(),
});

const orderSchema = z.object({
  planId: z.string(),
  os: z.string().optional(),
  rootPassword: z.string().min(8).optional(),
});

const keySchema = z.object({
  publicKey: z
    .string()
    .min(1, "Clé SSH requise")
    .max(5000, "Clé SSH trop longue")
    .refine(
      (v) => /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(256|384|521))\s+/.test(v.trim()),
      "Format de clé SSH invalide"
    ),
});

function resolveKvmTemplateId(os?: string, fallback?: number | null): number {
  if (os) {
    const direct = Number.parseInt(os, 10);
    if (Number.isFinite(direct) && direct > 0) return direct;
  }

  const mapRaw = process.env.KVM_TEMPLATE_MAP;
  if (mapRaw && os) {
    try {
      const parsed = JSON.parse(mapRaw) as Record<string, number | string>;
      const mapped = parsed[os];
      if (mapped !== undefined) {
        const mappedNum = Number.parseInt(String(mapped), 10);
        if (Number.isFinite(mappedNum) && mappedNum > 0) return mappedNum;
      }
    } catch {
      // ignore malformed env
    }
  }

  const env = process.env.KVM_TEMPLATE_VMID;
  const envNum = env ? Number.parseInt(env, 10) : NaN;
  if (Number.isFinite(envNum) && envNum > 0) return envNum;
  if (fallback && fallback > 0) return fallback;
  return 113;
}

function resolveKvmCiUser(): string {
  const env = process.env.KVM_CI_USER;
  if (env && env.trim()) return env.trim();
  return "root";
}

async function resolveLxcTemplate({
  proxmox,
  nodeName,
  selected,
  fallback,
}: {
  proxmox: ReturnType<typeof createProxmoxClient>;
  nodeName: string;
  selected?: string;
  fallback?: string | null;
}): Promise<{ template: string; warning?: string }> {
  const storage = process.env.PROXMOX_STORAGE || "SAN1";
  const templates = await proxmox.getTemplates(nodeName, storage);
  if (!templates.length) {
    return {
      template: selected ?? fallback ?? "local:vztmpl/debian-12-standard_12.0-1_amd64.tar.zst",
      warning: "Aucun template LXC détecté sur le nœud. Utilisation d'un fallback.",
    };
  }

  const hasSelected = selected && templates.some((t) => t.volid === selected);
  if (hasSelected) return { template: selected! };

  const hasFallback = fallback && templates.some((t) => t.volid === fallback);
  if (hasFallback) {
    return { template: fallback!, warning: "Template demandé indisponible, fallback appliqué." };
  }

  return { template: templates[0].volid, warning: "Template demandé indisponible, fallback appliqué." };
}

async function allocateVmid(
  proxmox: ReturnType<typeof createProxmoxClient>,
  min: number
): Promise<number> {
  const [existingDb, clusterVmids] = await Promise.all([
    query<{ vmid: number }>("SELECT vmid FROM vms"),
    proxmox.getClusterVMIDs(),
  ]);

  const used = new Set<number>(clusterVmids);
  for (const v of existingDb.rows) {
    const id = Number(v.vmid);
    if (Number.isFinite(id)) used.add(id);
  }

  let candidate = min;
  while (used.has(candidate)) candidate += 1;
  return candidate;
}

async function pickBestNode() {
  const res = await query<{
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    password: string;
    realm: string;
    ssl_verify: boolean;
    lxc_template_default: string | null;
    kvm_template_vmid: number | null;
    template_storage: string | null;
    vm_count: string;
  }>(
    `SELECT n.*, COUNT(v.id)::int AS vm_count
     FROM nodes n
     LEFT JOIN vms v ON v.node_id = n.id AND v.status NOT IN ('DELETING','ERROR')
     WHERE n.is_active = true
     GROUP BY n.id
     ORDER BY vm_count ASC
     LIMIT 1`
  );

  return res.rows[0] ?? null;
}

router.get("/", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const isAdmin = req.user!.role === "ADMIN";

  const vmsRes = await query<{
    id: string;
    name: string;
    status: string;
    vmid: number;
    type: string;
    ip: string | null;
    os: string | null;
    ssh_public_key: string | null;
    notes: string | null;
    plan_id: string;
    plan_name: string;
    plan_cpu: number;
    plan_ram_mb: number;
    plan_disk_gb: number;
    plan_bandwidth_gb: number | null;
    plan_price: string;
    plan_type: string;
    node_id: string;
    node_name: string;
  }>(
    `SELECT v.*, 
            p.name AS plan_name,
            p.cpu AS plan_cpu,
            p.ram_mb AS plan_ram_mb,
            p.disk_gb AS plan_disk_gb,
            p.bandwidth_gb AS plan_bandwidth_gb,
            p.price_monthly AS plan_price,
            p.type AS plan_type,
            n.id AS node_id,
            n.name AS node_name
     FROM vms v
     JOIN vm_plans p ON p.id = v.plan_id
     JOIN nodes n ON n.id = v.node_id
     WHERE ${isAdmin ? "TRUE" : "v.user_id = $1"}
     ORDER BY v.created_at DESC`,
    isAdmin ? [] : [userId]
  );

  const vms = vmsRes.rows.map((v) => ({
    id: v.id,
    name: v.name,
    status: v.status,
    vmid: v.vmid,
    type: v.type,
    ip: v.ip,
    os: v.os,
    sshPublicKey: v.ssh_public_key,
    notes: v.notes,
    planId: v.plan_id,
    plan: {
      id: v.plan_id,
      name: v.plan_name,
      cpu: v.plan_cpu,
      ramMb: v.plan_ram_mb,
      diskGb: v.plan_disk_gb,
      bandwidthGb: v.plan_bandwidth_gb,
      priceMonthly: Number(v.plan_price),
      type: v.plan_type,
    },
    node: { id: v.node_id, name: v.node_name },
  }));

  return res.json(vms);
});

router.get("/plans", requireAuth, async (_req, res) => {
  const plansRes = await query<{
    id: string;
    name: string;
    description: string | null;
    cpu: number;
    ram_mb: number;
    disk_gb: number;
    bandwidth_gb: number | null;
    price_monthly: string;
    type: string;
    is_active: boolean;
  }>(
    `SELECT id, name, description, cpu, ram_mb, disk_gb, bandwidth_gb, price_monthly, type, is_active
     FROM vm_plans
     WHERE is_active = true
     ORDER BY type ASC, price_monthly ASC`
  );

  const plans = plansRes.rows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    cpu: p.cpu,
    ramMb: p.ram_mb,
    diskGb: p.disk_gb,
    bandwidthGb: p.bandwidth_gb,
    priceMonthly: Number(p.price_monthly),
    type: p.type,
    isActive: p.is_active,
  }));

  return res.json(plans);
});

router.get("/nodes", requireAuth, async (_req, res) => {
  const nodesRes = await query<{
    id: string;
    name: string;
    is_active: boolean;
  }>(
    "SELECT id, name, is_active FROM nodes WHERE is_active = true ORDER BY name ASC"
  );

  const nodes = nodesRes.rows.map((n) => ({ id: n.id, name: n.name, isActive: n.is_active }));
  return res.json(nodes);
});

router.get("/:id", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const isAdmin = req.user!.role === "ADMIN";

  const vmRes = await query<{
    id: string;
    name: string;
    status: string;
    vmid: number;
    type: string;
    ip: string | null;
    os: string | null;
    ssh_public_key: string | null;
    notes: string | null;
    plan_id: string;
    plan_name: string;
    plan_cpu: number;
    plan_ram_mb: number;
    plan_disk_gb: number;
    plan_bandwidth_gb: number | null;
    plan_price: string;
    plan_type: string;
    node_id: string;
    node_name: string;
    node_host: string;
    user_id: string;
    user_email: string;
    user_name: string | null;
  }>(
    `SELECT v.*, 
            p.name AS plan_name,
            p.cpu AS plan_cpu,
            p.ram_mb AS plan_ram_mb,
            p.disk_gb AS plan_disk_gb,
            p.bandwidth_gb AS plan_bandwidth_gb,
            p.price_monthly AS plan_price,
            p.type AS plan_type,
            n.id AS node_id,
            n.name AS node_name,
            n.host AS node_host,
            u.id AS user_id,
            u.email AS user_email,
            u.name AS user_name
     FROM vms v
     JOIN vm_plans p ON p.id = v.plan_id
     JOIN nodes n ON n.id = v.node_id
     JOIN users u ON u.id = v.user_id
     WHERE v.id = $1 AND ${isAdmin ? "TRUE" : "v.user_id = $2"}
     LIMIT 1`,
    isAdmin ? [req.params.id] : [req.params.id, userId]
  );

  const v = vmRes.rows[0];
  if (!v) return res.status(404).json({ error: "VM introuvable" });

  return res.json({
    id: v.id,
    name: v.name,
    status: v.status,
    vmid: v.vmid,
    type: v.type,
    ip: v.ip,
    os: v.os,
    sshPublicKey: v.ssh_public_key,
    notes: v.notes,
    plan: {
      id: v.plan_id,
      name: v.plan_name,
      cpu: v.plan_cpu,
      ramMb: v.plan_ram_mb,
      diskGb: v.plan_disk_gb,
      bandwidthGb: v.plan_bandwidth_gb,
      priceMonthly: Number(v.plan_price),
      type: v.plan_type,
    },
    node: {
      id: v.node_id,
      name: v.node_name,
      host: v.node_host,
    },
    user: { id: v.user_id, email: v.user_email, name: v.user_name },
  });
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Données invalides" });
  }

  const { planId, name, os, type, nodeId } = parsed.data;

  const [planRes, nodeRes] = await Promise.all([
    query<{ id: string; is_active: boolean; cpu: number; ram_mb: number; disk_gb: number; type: string }>(
      "SELECT id, is_active, cpu, ram_mb, disk_gb, type FROM vm_plans WHERE id = $1",
      [planId]
    ),
    query<{
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
    }>("SELECT * FROM nodes WHERE id = $1", [nodeId]),
  ]);

  const plan = planRes.rows[0];
  const node = nodeRes.rows[0];
  if (!plan || !plan.is_active) return res.status(404).json({ error: "Plan introuvable" });
  if (!node || !node.is_active) return res.status(404).json({ error: "Nœud introuvable" });

  const proxmox = createProxmoxClient({
    host: node.host,
    port: node.port,
    username: node.username,
    password: node.password,
    realm: node.realm,
    sslVerify: node.ssl_verify,
  });

  try {
    const vmid = await allocateVmid(proxmox, type === "LXC" ? 5000 : 6000);
    const storage = process.env.PROXMOX_STORAGE || "SAN1";

    if (type === "LXC") {
      const lxcResolved = await resolveLxcTemplate({
        proxmox,
        nodeName: node.name,
        selected: os,
        fallback: node.lxc_template_default,
      });
      await proxmox.createLXC(node.name, {
        vmid,
        hostname: name,
        ostemplate: lxcResolved.template,
        cores: plan.cpu,
        memory: plan.ram_mb,
        rootfs: `${storage}:${plan.disk_gb}`,
        net0: "name=eth0,bridge=PUBLIC,ip=dhcp",
        pool: process.env.PROXMOX_POOL || undefined,
        start: true,
      });
    } else {
      const templateVmid = resolveKvmTemplateId(os, node.kvm_template_vmid);
      const upid = await proxmox.cloneKVMTemplate(node.name, templateVmid, {
        newid: vmid,
        name,
        full: true,
        storage,
        pool: process.env.PROXMOX_POOL || undefined,
      });
      await proxmox.waitForTask(node.name, upid, 120000);
      await proxmox.setKVMConfig(node.name, vmid, {
        cores: plan.cpu,
        memory: plan.ram_mb,
        net0: "virtio,bridge=PUBLIC",
        boot: "order=scsi0",
        ipconfig0: "ip=dhcp",
        ciuser: resolveKvmCiUser(),
      });
      await proxmox.startVM(node.name, vmid, "qemu");
    }

    const insert = await query<{ id: string }>(
      `INSERT INTO vms (vmid, name, type, status, os, user_id, node_id, plan_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [
        vmid,
        name,
        type,
        "RUNNING",
        os ?? null,
        req.user!.id,
        node.id,
        plan.id,
      ]
    );

    return res.status(201).json({ id: insert.rows[0]?.id });
  } catch (err) {
    return res.status(500).json({ error: "Erreur lors de la création de la VM" });
  }
});

router.post("/order", requireAuth, async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Données invalides" });
  }

  const { planId, os, rootPassword } = parsed.data;
  const planRes = await query<{
    id: string;
    name: string;
    type: string;
    cpu: number;
    ram_mb: number;
    disk_gb: number;
    price_monthly: string;
    stripe_price_id: string | null;
  }>(
    "SELECT id, name, type, cpu, ram_mb, disk_gb, price_monthly, stripe_price_id FROM vm_plans WHERE id = $1 AND is_active = true",
    [planId]
  );
  const plan = planRes.rows[0];
  if (!plan) return res.status(404).json({ error: "Plan introuvable" });

  const hostname = generateHostname(plan.name);

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey && !stripeKey.includes("placeholder")) {
    try {
      const Stripe = (await import("stripe")).default;
      const client = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" as never });
      let priceId = plan.stripe_price_id;
      if (!priceId) {
        const { createProductAndPrice } = await import("../lib/stripe.js");
        priceId = await createProductAndPrice(plan.name, Number(plan.price_monthly));
        await query("UPDATE vm_plans SET stripe_price_id = $1 WHERE id = $2", [priceId, plan.id]);
      }

      const userRes = await query<{ id: string; email: string; name: string | null; stripe_customer_id: string | null }>(
        "SELECT id, email, name, stripe_customer_id FROM users WHERE id = $1",
        [req.user!.id]
      );
      const user = userRes.rows[0];
      if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

      let customerId = user.stripe_customer_id;
      if (!customerId) {
        const { createOrRetrieveCustomer } = await import("../lib/stripe.js");
        customerId = await createOrRetrieveCustomer(user.email, user.name);
        await query("UPDATE users SET stripe_customer_id = $1 WHERE id = $2", [customerId, user.id]);
      }

      const origin = req.headers.origin ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002";
      const checkoutSession = await client.checkout.sessions.create({
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        subscription_data: {
          metadata: {
            os: os ?? "",
            planId,
            userId: req.user!.id,
            rootPassword: rootPassword ?? "",
          },
        },
        success_url: `${origin}/vms?ordered=true`,
        cancel_url: `${origin}/vms/new/${planId}`,
      });

      return res.json({ checkoutUrl: checkoutSession.url });
    } catch (err) {
      return res.status(500).json({ error: "Erreur lors de la création du paiement Stripe" });
    }
  }

  const node = await pickBestNode();
  if (!node) {
    return res.status(503).json({
      error: "Aucun nœud Proxmox actif. Ajoutez un nœud dans /admin/nodes avant de commander.",
      code: "NO_NODES",
    });
  }

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
    let warning: string | null = null;
    const storage = process.env.PROXMOX_STORAGE || "SAN1";

    if (plan.type === "LXC") {
      const lxcResolved = await resolveLxcTemplate({
        proxmox,
        nodeName: node.name,
        selected: os,
        fallback: node.lxc_template_default,
      });
      if (lxcResolved.warning) warning = lxcResolved.warning;
      await proxmox.createLXC(node.name, {
        vmid,
        hostname,
        ostemplate: lxcResolved.template,
        cores: plan.cpu,
        memory: plan.ram_mb,
        rootfs: `${storage}:${plan.disk_gb}`,
        net0: "name=eth0,bridge=PUBLIC,ip=dhcp",
        password: rootPassword,
        pool: process.env.PROXMOX_POOL || undefined,
        start: true,
      });
    } else {
      const templateVmid = resolveKvmTemplateId(os, node.kvm_template_vmid);
      const upid = await proxmox.cloneKVMTemplate(node.name, templateVmid, {
        newid: vmid,
        name: hostname,
        full: true,
        storage,
        pool: process.env.PROXMOX_POOL || undefined,
      });
      await proxmox.waitForTask(node.name, upid, 120000);
      await proxmox.setKVMConfig(node.name, vmid, {
        cores: plan.cpu,
        memory: plan.ram_mb,
        net0: "virtio,bridge=PUBLIC",
        boot: "order=scsi0",
        ipconfig0: "ip=dhcp",
        serial0: "socket",
        vga: "serial0",
        ...(rootPassword ? { ciuser: resolveKvmCiUser(), cipassword: rootPassword } : {}),
      });
      await proxmox.startVM(node.name, vmid, "qemu");
    }

    const insert = await query<{ id: string }>(
      `INSERT INTO vms (vmid, name, type, status, os, user_id, node_id, plan_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [
        vmid,
        hostname,
        plan.type,
        "RUNNING",
        os ?? null,
        req.user!.id,
        node.id,
        plan.id,
      ]
    );

    return res.json({ vmId: insert.rows[0]?.id, ...(warning ? { warning } : {}) });
  } catch (err: unknown) {
    let proxmoxMsg = "Erreur inconnue";
    if (err && typeof err === "object" && "response" in err) {
      const axiosErr = err as { response?: { data?: { errors?: Record<string, string>; message?: string }; status?: number } };
      const d = axiosErr.response?.data;
      if (d?.errors) proxmoxMsg = Object.entries(d.errors).map(([k, v]) => `${k}: ${v}`).join(", ");
      else if (d?.message) proxmoxMsg = d.message;
      else proxmoxMsg = `HTTP ${axiosErr.response?.status}`;
    } else if (err instanceof Error) {
      proxmoxMsg = err.message;
    }

    return res.status(502).json({
      error: `Échec du provisioning Proxmox : ${proxmoxMsg}`,
      hint: proxmoxMsg.toLowerCase().includes("template") || proxmoxMsg.toLowerCase().includes("ostemplate")
        ? "Le template OS (LXC) ou le template KVM est introuvable. Vérifiez l'ID du template KVM (KVM_TEMPLATE_VMID) et/ou téléchargez le CT template depuis Proxmox → Node → CT Templates."
        : "Vérifiez les logs Proxmox, le stockage disponible et les paramètres du nœud.",
      code: "PROXMOX_ERROR",
    });
  }
});

router.get("/:id/status", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const isAdmin = req.user!.role === "ADMIN";

  const vmRes = await query<{
    id: string;
    vmid: number;
    status: string;
    type: string;
    ip: string | null;
    node_name: string;
    node_host: string;
    node_port: number;
    node_username: string;
    node_password: string;
    node_realm: string;
    node_ssl_verify: boolean;
  }>(
    `SELECT v.id, v.vmid, v.status, v.type, v.ip,
            n.name AS node_name, n.host AS node_host, n.port AS node_port,
            n.username AS node_username, n.password AS node_password, n.realm AS node_realm, n.ssl_verify AS node_ssl_verify
     FROM vms v
     JOIN nodes n ON n.id = v.node_id
     WHERE v.id = $1 AND ${isAdmin ? "TRUE" : "v.user_id = $2"}
     LIMIT 1`,
    isAdmin ? [req.params.id] : [req.params.id, userId]
  );

  const vm = vmRes.rows[0];
  if (!vm) return res.status(404).json({ error: "VM introuvable" });

  if (vm.vmid === 0) return res.json({ status: vm.status });

  try {
    const proxmox = createProxmoxClient({
      host: vm.node_host,
      port: vm.node_port,
      username: vm.node_username,
      password: vm.node_password,
      realm: vm.node_realm,
      sslVerify: vm.node_ssl_verify,
    });

    const type = vm.type === "LXC" ? "lxc" : "qemu";
    const status = await proxmox.getVMStatus(vm.node_name, vm.vmid, type);

    const mappedStatus = status.status === "running" ? "RUNNING"
      : status.status === "stopped" ? "STOPPED"
      : status.status === "suspended" ? "SUSPENDED"
      : "STOPPED";

    let ip = vm.ip;
    if (mappedStatus === "RUNNING" && !ip) {
      try {
        if (type === "lxc") ip = await proxmox.getLXCIP(vm.node_name, vm.vmid);
        else ip = await proxmox.getKVMAgentIP(vm.node_name, vm.vmid);
      } catch {
        // ignore
      }
    }

    const updates: Array<Promise<unknown>> = [];
    if (vm.status !== mappedStatus) {
      updates.push(query("UPDATE vms SET status = $1 WHERE id = $2", [mappedStatus, vm.id]));
    }
    if (ip && ip !== vm.ip) {
      updates.push(query("UPDATE vms SET ip = $1 WHERE id = $2", [ip, vm.id]));
    }
    await Promise.all(updates);

    return res.json({
      status: mappedStatus,
      ip: ip ?? null,
      cpu: status.cpu,
      mem: status.mem,
      maxmem: status.maxmem,
      disk: status.disk,
      maxdisk: status.maxdisk,
      uptime: status.uptime,
      netin: status.netin,
      netout: status.netout,
    });
  } catch {
    return res.json({ status: vm.status, error: "Proxmox inaccessible" });
  }
});

router.post("/:id/start", requireAuth, async (req, res) => {
  await handlePower(req, res, "start");
});

router.post("/:id/stop", requireAuth, async (req, res) => {
  await handlePower(req, res, "stop");
});

router.post("/:id/shutdown", requireAuth, async (req, res) => {
  await handlePower(req, res, "shutdown");
});

router.post("/:id/reboot", requireAuth, async (req, res) => {
  await handlePower(req, res, "reboot");
});

router.post("/:id/reset", requireAuth, async (req, res) => {
  await handlePower(req, res, "reset");
});

async function handlePower(req: any, res: any, action: "start" | "stop" | "shutdown" | "reboot" | "reset") {
  const userId = req.user!.id;
  const isAdmin = req.user!.role === "ADMIN";

  const vmRes = await query<{
    id: string;
    vmid: number;
    type: string;
    node_name: string;
    node_host: string;
    node_port: number;
    node_username: string;
    node_password: string;
    node_realm: string;
    node_ssl_verify: boolean;
  }>(
    `SELECT v.id, v.vmid, v.type,
            n.name AS node_name, n.host AS node_host, n.port AS node_port,
            n.username AS node_username, n.password AS node_password, n.realm AS node_realm, n.ssl_verify AS node_ssl_verify
     FROM vms v
     JOIN nodes n ON n.id = v.node_id
     WHERE v.id = $1 AND ${isAdmin ? "TRUE" : "v.user_id = $2"}
     LIMIT 1`,
    isAdmin ? [req.params.id] : [req.params.id, userId]
  );

  const vm = vmRes.rows[0];
  if (!vm) return res.status(404).json({ error: "VM introuvable" });

  try {
    const proxmox = createProxmoxClient({
      host: vm.node_host,
      port: vm.node_port,
      username: vm.node_username,
      password: vm.node_password,
      realm: vm.node_realm,
      sslVerify: vm.node_ssl_verify,
    });

    const type = vm.type === "LXC" ? "lxc" : "qemu";
    switch (action) {
      case "start":
        await proxmox.startVM(vm.node_name, vm.vmid, type);
        await query("UPDATE vms SET status = 'RUNNING' WHERE id = $1", [vm.id]);
        break;
      case "stop":
        await proxmox.stopVM(vm.node_name, vm.vmid, type);
        await query("UPDATE vms SET status = 'STOPPED' WHERE id = $1", [vm.id]);
        break;
      case "shutdown":
        await proxmox.shutdownVM(vm.node_name, vm.vmid, type);
        await query("UPDATE vms SET status = 'STOPPED' WHERE id = $1", [vm.id]);
        break;
      case "reboot":
        await proxmox.rebootVM(vm.node_name, vm.vmid, type);
        break;
      case "reset":
        await proxmox.resetVM(vm.node_name, vm.vmid, type);
        break;
    }

    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "Erreur lors de l'action" });
  }
}

router.post("/:id/ssh-key", requireAuth, async (req, res) => {
  const parsed = keySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Données invalides" });
  }

  const userId = req.user!.id;
  const isAdmin = req.user!.role === "ADMIN";

  const vmRes = await query<{
    id: string;
    vmid: number;
    type: string;
    node_name: string;
    node_host: string;
    node_port: number;
    node_username: string;
    node_password: string;
    node_realm: string;
    node_ssl_verify: boolean;
  }>(
    `SELECT v.id, v.vmid, v.type,
            n.name AS node_name, n.host AS node_host, n.port AS node_port,
            n.username AS node_username, n.password AS node_password, n.realm AS node_realm, n.ssl_verify AS node_ssl_verify
     FROM vms v
     JOIN nodes n ON n.id = v.node_id
     WHERE v.id = $1 AND ${isAdmin ? "TRUE" : "v.user_id = $2"}
     LIMIT 1`,
    isAdmin ? [req.params.id] : [req.params.id, userId]
  );

  const vm = vmRes.rows[0];
  if (!vm) return res.status(404).json({ error: "VM introuvable" });
  if (vm.vmid === 0) return res.status(409).json({ error: "VM en attente de provisioning" });

  const publicKey = parsed.data.publicKey.trim();

  try {
    const proxmox = createProxmoxClient({
      host: vm.node_host,
      port: vm.node_port,
      username: vm.node_username,
      password: vm.node_password,
      realm: vm.node_realm,
      sslVerify: vm.node_ssl_verify,
    });

    const cleaned = publicKey.trim().replace(/\s+/g, " ");
    const parts = cleaned.split(" ");
    const normalizedKey = parts.length >= 2 ? `${parts[0]} ${parts[1]}` : cleaned;
    const encodedKey = encodeURIComponent(encodeURIComponent(normalizedKey));

    if (vm.type === "KVM") {
      await proxmox.setKVMConfigRaw(vm.node_name, vm.vmid, `sshkeys=${encodedKey}`);
    } else {
      await proxmox.setLXCConfigRaw(vm.node_name, vm.vmid, `ssh-public-keys=${encodedKey}`);
    }

    await query("UPDATE vms SET ssh_public_key = $1 WHERE id = $2", [publicKey, vm.id]);
    return res.json({ ok: true });
  } catch (err: unknown) {
    let proxmoxMsg = "Erreur inconnue";
    if (err && typeof err === "object" && "response" in err) {
      const axiosErr = err as { response?: { data?: { errors?: Record<string, string>; message?: string }; status?: number } };
      const d = axiosErr.response?.data;
      if (d?.errors) proxmoxMsg = Object.entries(d.errors).map(([k, v]) => `${k}: ${v}`).join(", ");
      else if (d?.message) proxmoxMsg = d.message;
      else proxmoxMsg = `HTTP ${axiosErr.response?.status}`;
    } else if (err instanceof Error) {
      proxmoxMsg = err.message;
    }

    const lower = proxmoxMsg.toLowerCase();
    const hint =
      lower.includes("cloud-init") || lower.includes("cloudinit") || lower.includes("ide2")
        ? "Le template KVM doit avoir un disque Cloud-Init (ex: ide2: cloudinit)."
        : lower.includes("ssh")
          ? "Vérifiez le format de la clé SSH publique (ssh-ed25519/ssh-rsa/ecdsa...)."
          : "Vérifiez les droits API Proxmox et la configuration du template.";

    return res.status(502).json({ error: `Erreur Proxmox : ${proxmoxMsg}`, hint });
  }
});

router.post("/:id/console", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const isAdmin = req.user!.role === "ADMIN";

  const vmRes = await query<{
    id: string;
    vmid: number;
    type: string;
    status: string;
    node_name: string;
    node_host: string;
    node_port: number;
    node_username: string;
    node_password: string;
    node_realm: string;
    node_ssl_verify: boolean;
  }>(
    `SELECT v.id, v.vmid, v.type, v.status,
            n.name AS node_name, n.host AS node_host, n.port AS node_port,
            n.username AS node_username, n.password AS node_password, n.realm AS node_realm, n.ssl_verify AS node_ssl_verify
     FROM vms v
     JOIN nodes n ON n.id = v.node_id
     WHERE v.id = $1 AND ${isAdmin ? "TRUE" : "v.user_id = $2"}
     LIMIT 1`,
    isAdmin ? [req.params.id] : [req.params.id, userId]
  );

  const vm = vmRes.rows[0];
  if (!vm) return res.status(404).json({ error: "VM introuvable" });
  if (vm.status !== "RUNNING") return res.status(400).json({ error: "La VM doit être démarrée" });

  const proxmox = createProxmoxClient({
    host: vm.node_host,
    port: vm.node_port,
    username: vm.node_username,
    password: vm.node_password,
    realm: vm.node_realm,
    sslVerify: vm.node_ssl_verify,
  });

  try {
    const type = vm.type === "LXC" ? "lxc" : "qemu";
    const [authCookie, proxy] = await Promise.all([
      proxmox.getAuthCookie(),
      proxmox.createVncProxy(vm.node_name, vm.vmid, type),
    ]);

    const wsPath = type === "lxc" ? "lxc" : "qemu";
    const proxmoxWsUrl = `wss://${vm.node_host}:${vm.node_port}/api2/json/nodes/${vm.node_name}/${wsPath}/${vm.vmid}/vncwebsocket?port=${proxy.port}&vncticket=${encodeURIComponent(proxy.ticket)}`;

    const sessions = (globalThis as Record<string, unknown>).__consoleSessions as Map<string, unknown> | undefined;
    if (!sessions) {
      return res.status(503).json({ error: "Proxy WebSocket non initialisé" });
    }

    const token = crypto.randomUUID();
    sessions.set(token, {
      proxmoxWsUrl,
      proxmoxAuthCookie: authCookie,
      sslVerify: vm.node_ssl_verify === true,
      expiresAt: Date.now() + 30_000,
    });

    return res.json({ wsToken: token, vncPassword: proxy.ticket });
  } catch {
    return res.status(500).json({ error: "Impossible d'ouvrir la console" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const isAdmin = req.user!.role === "ADMIN";

  const vmRes = await query<{
    id: string;
    vmid: number;
    type: string;
    node_name: string;
    node_host: string;
    node_port: number;
    node_username: string;
    node_password: string;
    node_realm: string;
    node_ssl_verify: boolean;
  }>(
    `SELECT v.id, v.vmid, v.type,
            n.name AS node_name, n.host AS node_host, n.port AS node_port,
            n.username AS node_username, n.password AS node_password, n.realm AS node_realm, n.ssl_verify AS node_ssl_verify
     FROM vms v
     JOIN nodes n ON n.id = v.node_id
     WHERE v.id = $1 AND ${isAdmin ? "TRUE" : "v.user_id = $2"}
     LIMIT 1`,
    isAdmin ? [req.params.id] : [req.params.id, userId]
  );

  const vm = vmRes.rows[0];
  if (!vm) return res.status(404).json({ error: "VM introuvable" });

  try {
    const proxmox = createProxmoxClient({
      host: vm.node_host,
      port: vm.node_port,
      username: vm.node_username,
      password: vm.node_password,
      realm: vm.node_realm,
      sslVerify: vm.node_ssl_verify,
    });

    const type = vm.type === "LXC" ? "lxc" : "qemu";
    await proxmox.deleteVM(vm.node_name, vm.vmid, type);
    await query("DELETE FROM vms WHERE id = $1", [vm.id]);

    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

function generateHostname(planName: string): string {
  const slug = planName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${slug}-${suffix}`;
}

export default router;
