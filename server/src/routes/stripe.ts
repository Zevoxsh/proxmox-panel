import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { createOrRetrieveCustomer, createCheckoutSession, createBillingPortalSession, constructWebhookEvent } from "../lib/stripe.js";
import { createPteroAppClient } from "../lib/pterodactyl.js";
import { createProxmoxClient } from "../lib/proxmox.js";
import Stripe from "stripe";

const router = Router();

const schema = z.object({
  planId: z.string().optional(),
  type: z.enum(["VPS", "GAME"]).optional(),
  items: z.array(z.object({
    planId: z.string(),
    type: z.enum(["VPS", "GAME"]),
  })).optional(),
}).refine((val) => val.planId || (val.items && val.items.length > 0), {
  message: "Données invalides",
});

router.post("/checkout", requireAuth, async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error("[stripe] invalid checkout payload", parsed.error.flatten());
    return res.status(400).json({ error: "Données invalides" });
  }

  const items = parsed.data.items?.length
    ? parsed.data.items
    : [{ planId: parsed.data.planId!, type: parsed.data.type ?? "VPS" }];

  const priceIds: string[] = [];
  for (const item of items) {
    const planRes = await query<{
      id: string;
      stripe_price_id: string | null;
    }>(
      item.type === "GAME"
        ? "SELECT id, stripe_price_id FROM game_plans WHERE id = $1 AND is_active = true"
        : "SELECT id, stripe_price_id FROM vm_plans WHERE id = $1 AND is_active = true",
      [item.planId]
    );
    const plan = planRes.rows[0];
    if (!plan) return res.status(404).json({ error: "Plan introuvable" });
    if (!plan.stripe_price_id) {
      return res.status(400).json({ error: "Ce plan n'a pas de prix Stripe configuré" });
    }
    priceIds.push(plan.stripe_price_id);
  }

  const userRes = await query<{
    id: string;
    email: string;
    name: string | null;
    stripe_customer_id: string | null;
  }>("SELECT id, email, name, stripe_customer_id FROM users WHERE id = $1", [req.user!.id]);
  const user = userRes.rows[0];
  if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

  let customerId = user.stripe_customer_id;
  if (!customerId) {
    customerId = await createOrRetrieveCustomer(user.email, user.name);
    await query("UPDATE users SET stripe_customer_id = $1 WHERE id = $2", [customerId, user.id]);
  }

  const origin = req.headers.origin ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002";
  const url = await createCheckoutSession(
    customerId,
    priceIds,
    `${origin}/billing?success=true`,
    `${origin}/billing/plans?canceled=true`,
    {
      userId: req.user!.id,
      items: JSON.stringify(items),
    }
  );

  return res.json({ url });
});

router.post("/portal", requireAuth, async (req, res) => {
  const userRes = await query<{ stripe_customer_id: string | null }>(
    "SELECT stripe_customer_id FROM users WHERE id = $1",
    [req.user!.id]
  );
  const user = userRes.rows[0];
  if (!user?.stripe_customer_id) return res.status(400).json({ error: "Aucun abonnement actif" });

  const origin = req.headers.origin ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002";
  const url = await createBillingPortalSession(user.stripe_customer_id, `${origin}/billing`);

  return res.json({ url });
});

router.post("/webhook", async (req, res) => {
  const signature = req.headers["stripe-signature"] as string | undefined;
  if (!signature) return res.status(400).json({ error: "Signature manquante" });

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(req.body, signature);
  } catch {
    return res.status(400).json({ error: "Signature invalide" });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const priceIds = sub.items.data.map((i) => i.price?.id).filter(Boolean) as string[];
        if (priceIds.length === 0) break;

        const userRes = await query<{ id: string }>(
          "SELECT id FROM users WHERE stripe_customer_id = $1",
          [sub.customer as string]
        );
        const user = userRes.rows[0];
        if (!user) break;

        await Promise.all([
          query("DELETE FROM subscriptions WHERE stripe_sub_id = $1", [sub.id]),
          query("DELETE FROM game_subscriptions WHERE stripe_sub_id = $1", [sub.id]),
        ]);

        for (const priceId of priceIds) {
          const vmPlanRes = await query<{ id: string; cpu: number; ram_mb: number; disk_gb: number; name: string; type: string }>(
            "SELECT id, cpu, ram_mb, disk_gb, name, type FROM vm_plans WHERE stripe_price_id = $1",
            [priceId]
          );
          const vmPlan = vmPlanRes.rows[0];
          if (vmPlan) {
            await query(
              `INSERT INTO subscriptions (stripe_sub_id, status, current_period_start, current_period_end, cancel_at_period_end, user_id, plan_id)
               VALUES ($1,$2,$3,$4,$5,$6,$7)`,
              [
                sub.id,
                normalizeSubStatus(sub.status),
                new Date(sub.current_period_start * 1000),
                new Date(sub.current_period_end * 1000),
                sub.cancel_at_period_end,
                user.id,
                vmPlan.id,
              ]
            );

            if (event.type === "customer.subscription.created" && sub.metadata.userId) {
              const { os, rootPassword } = sub.metadata;
              await provisionVMFromWebhook({
                plan: { id: vmPlan.id, name: vmPlan.name, type: vmPlan.type, cpu: vmPlan.cpu, ramMb: vmPlan.ram_mb, diskGb: vmPlan.disk_gb },
                userId: user.id,
                os: os || undefined,
                rootPassword: rootPassword || undefined,
              });
            }
            continue;
          }

          const gamePlanRes = await query<{ id: string }>("SELECT id FROM game_plans WHERE stripe_price_id = $1", [priceId]);
          const gamePlan = gamePlanRes.rows[0];
          if (gamePlan) {
            await query(
              `INSERT INTO game_subscriptions (stripe_sub_id, status, current_period_start, current_period_end, cancel_at_period_end, user_id, plan_id, pending_plan_id)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
              [
                sub.id,
                normalizeSubStatus(sub.status),
                new Date(sub.current_period_start * 1000),
                new Date(sub.current_period_end * 1000),
                sub.cancel_at_period_end,
                user.id,
                gamePlan.id,
                gamePlan.id,
              ]
            );
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await Promise.all([
          query("UPDATE subscriptions SET status = 'CANCELED' WHERE stripe_sub_id = $1", [sub.id]),
          query("UPDATE game_subscriptions SET status = 'CANCELED' WHERE stripe_sub_id = $1", [sub.id]),
        ]);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const userRes = await query<{ id: string }>(
          "SELECT id FROM users WHERE stripe_customer_id = $1",
          [invoice.customer as string]
        );
        const user = userRes.rows[0];
        if (!user) break;

        await query(
          `INSERT INTO invoices (stripe_invoice_id, amount, currency, status, pdf_url, hosted_url, paid_at, user_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (stripe_invoice_id) DO UPDATE SET
             status = 'PAID',
             paid_at = EXCLUDED.paid_at,
             pdf_url = EXCLUDED.pdf_url,
             hosted_url = EXCLUDED.hosted_url`,
          [
            invoice.id,
            invoice.amount_paid / 100,
            invoice.currency,
            "PAID",
            invoice.invoice_pdf ?? null,
            invoice.hosted_invoice_url ?? null,
            new Date(),
            user.id,
          ]
        );

        const priceIds = (invoice.lines?.data ?? []).map((l) => l.price?.id).filter(Boolean) as string[];
        for (const priceId of priceIds) {
          const gamePlanRes = await query<{
            id: string;
            game: string;
            cpu: number;
            ram_mb: number;
            disk_mb: number;
            databases: number;
            backups: number;
            allocations: number;
            egg_id: number;
            docker_image: string;
            startup: string;
            env_vars: unknown;
            panel_id: string;
            panel_url: string;
            panel_api_key: string;
          }>(
            `SELECT g.*, p.url AS panel_url, p.api_key AS panel_api_key
             FROM game_plans g
             JOIN ptero_panels p ON p.id = g.panel_id
             WHERE g.stripe_price_id = $1 AND g.is_active = true`,
            [priceId]
          );
          const gamePlan = gamePlanRes.rows[0];
          if (!gamePlan) continue;

          const existingRes = await query<{ id: string }>(
            "SELECT id FROM game_servers WHERE user_id = $1 AND plan_id = $2 ORDER BY created_at DESC LIMIT 1",
            [user.id, gamePlan.id]
          );

          if (!existingRes.rows[0]) {
            try {
              const userInfoRes = await query<{ email: string; name: string | null }>(
                "SELECT email, name FROM users WHERE id = $1",
                [user.id]
              );
              const userInfo = userInfoRes.rows[0];

              const ptero = createPteroAppClient(gamePlan.panel_url, gamePlan.panel_api_key);
              const username = userInfo.email.split("@")[0];
              const pteroUser = await ptero.findOrCreateUser(userInfo.email, username, userInfo.name ?? username);

              const envVars = (gamePlan.env_vars as Record<string, string> | null) ?? {};
              const serverName = `${gamePlan.game}-${userInfo.email.split("@")[0]}`;

              const server = await ptero.createServer({
                name: serverName,
                user: pteroUser.id,
                egg: gamePlan.egg_id,
                docker_image: gamePlan.docker_image,
                startup: gamePlan.startup,
                environment: envVars,
                limits: { memory: gamePlan.ram_mb, disk: gamePlan.disk_mb, cpu: gamePlan.cpu, swap: 0, io: 500 },
                feature_limits: { databases: gamePlan.databases, backups: gamePlan.backups, allocations: gamePlan.allocations },
                deploy: { locations: [1], dedicated_ip: false, port_range: [] },
              });

              await query(
                `INSERT INTO game_servers
                 (ptero_uuid, ptero_id, identifier, name, status, ptero_user_id, user_id, panel_id, plan_id)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                [
                  server.uuid,
                  server.id,
                  server.identifier,
                  serverName,
                  "INSTALLING",
                  pteroUser.id,
                  user.id,
                  gamePlan.panel_id,
                  gamePlan.id,
                ]
              );
            } catch {
              // ignore
            }
          }
        }

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const userRes = await query<{ id: string }>(
          "SELECT id FROM users WHERE stripe_customer_id = $1",
          [invoice.customer as string]
        );
        const user = userRes.rows[0];
        if (!user) break;

        await query(
          `INSERT INTO invoices (stripe_invoice_id, amount, currency, status, user_id)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (stripe_invoice_id) DO UPDATE SET
             status = 'OPEN'`,
          [invoice.id, invoice.amount_due / 100, invoice.currency, "OPEN", user.id]
        );
        break;
      }
    }

    return res.json({ received: true });
  } catch {
    return res.status(500).json({ error: "Erreur de traitement" });
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

async function provisionVMFromWebhook({
  plan,
  userId,
  os,
  rootPassword,
}: {
  plan: { id: string; name: string; type: string; cpu: number; ramMb: number; diskGb: number };
  userId: string;
  os?: string;
  rootPassword?: string;
}) {
  const hostname = generateHostname(plan.name);

  const nodesRes = await query<{
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
    vm_count: string;
  }>(
    `SELECT n.*, COUNT(v.id)::int AS vm_count
     FROM nodes n
     LEFT JOIN vms v ON v.node_id = n.id AND v.status NOT IN ('DELETING','ERROR')
     WHERE n.is_active = true
     GROUP BY n.id
     ORDER BY vm_count ASC`,
  );

  const nodes = nodesRes.rows;
  if (!nodes.length) {
    await query(
      `INSERT INTO vms (vmid, name, type, status, os, user_id, node_id, plan_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [0, hostname, plan.type, "PENDING", os ?? null, userId, nodes[0]?.id ?? null, plan.id]
    );
    return;
  }

  const node = nodes[0];

  async function allocateVmid(min: number) {
    const [existingDb, clusterVmids] = await Promise.all([
      query<{ vmid: number }>("SELECT vmid FROM vms"),
      createProxmoxClient({
        host: node.host,
        port: node.port,
        username: node.username,
        password: node.password,
        realm: node.realm,
        sslVerify: node.ssl_verify,
      }).getClusterVMIDs(),
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

  function resolveKvmTemplateId(value?: string, fallback?: number | null): number {
    if (value) {
      const direct = Number.parseInt(value, 10);
      if (Number.isFinite(direct) && direct > 0) return direct;
    }
    const env = process.env.KVM_TEMPLATE_VMID;
    const envNum = env ? Number.parseInt(env, 10) : NaN;
    if (Number.isFinite(envNum) && envNum > 0) return envNum;
    if (fallback && fallback > 0) return fallback;
    return 113;
  }

  function resolveKvmCiUser(value?: string): string {
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
  }): Promise<string> {
    const templates = await proxmox.getTemplates(nodeName);
    if (!templates.length) {
      return selected ?? fallback ?? "local:vztmpl/debian-12-standard_12.0-1_amd64.tar.zst";
    }

    if (selected && templates.some((t) => t.volid === selected)) return selected;
    if (fallback && templates.some((t) => t.volid === fallback)) return fallback;
    return templates[0].volid;
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

    const vmid = await allocateVmid(plan.type === "LXC" ? 5000 : 6000);

    if (plan.type === "LXC") {
      const lxcTemplate = await resolveLxcTemplate({
        proxmox,
        nodeName: node.name,
        selected: os,
        fallback: node.lxc_template_default,
      });
      await proxmox.createLXC(node.name, {
        vmid,
        hostname,
        ostemplate: lxcTemplate,
        cores: plan.cpu,
        memory: plan.ramMb,
        rootfs: `SAN1:${plan.diskGb}`,
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
        pool: process.env.PROXMOX_POOL || undefined,
      });

      await proxmox.waitForTask(node.name, upid, 120000);

      await proxmox.setKVMConfig(node.name, vmid, {
        cores: plan.cpu,
        memory: plan.ramMb,
        net0: "virtio,bridge=PUBLIC",
        boot: "order=scsi0",
        ipconfig0: "ip=dhcp",
        serial0: "socket",
        vga: "serial0",
        ...(rootPassword ? { ciuser: resolveKvmCiUser(os), cipassword: rootPassword } : {}),
      });

      await proxmox.startVM(node.name, vmid, "qemu");
    }

    await query(
      `INSERT INTO vms (vmid, name, type, status, os, user_id, node_id, plan_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [vmid, hostname, plan.type, "RUNNING", os ?? null, userId, node.id, plan.id]
    );
  } catch {
    await query(
      `INSERT INTO vms (vmid, name, type, status, os, user_id, node_id, plan_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [0, hostname, plan.type, "PENDING", os ?? null, userId, node.id, plan.id]
    );
  }
}

function normalizeSubStatus(status: string): "ACTIVE" | "CANCELED" | "PAST_DUE" | "UNPAID" | "TRIALING" {
  const map: Record<string, "ACTIVE" | "CANCELED" | "PAST_DUE" | "UNPAID" | "TRIALING"> = {
    active: "ACTIVE",
    canceled: "CANCELED",
    past_due: "PAST_DUE",
    unpaid: "UNPAID",
    trialing: "TRIALING",
  };
  return map[status] ?? "ACTIVE";
}

export default router;
