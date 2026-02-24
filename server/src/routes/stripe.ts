import { Router } from "express";
import Stripe from "stripe";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { createBillingPortalSession, createCheckoutSession, createOrRetrieveCustomer, createProductAndPrice, constructWebhookEvent } from "../lib/stripe.js";
import { createProxmoxClient } from "../lib/proxmox.js";
import { createPteroAppClient } from "../lib/pterodactyl.js";

const router = Router();

router.post("/checkout", requireAuth, async (req, res) => {
  const { planId, type } = req.body as { planId?: string; type?: "VPS" | "GAME" };
  if (!planId) return res.status(400).json({ error: "Données invalides" });

  if (type === "GAME") {
    const planRes = await query("SELECT id, name, price_monthly, stripe_price_id FROM game_plans WHERE id = $1 AND is_active = true", [planId]);
    const plan = planRes.rows[0];
    if (!plan) return res.status(404).json({ error: "Plan introuvable" });
    let priceId = plan.stripe_price_id as string | null;
    if (!priceId) {
      priceId = await createProductAndPrice(plan.name, Number(plan.price_monthly));
      await query("UPDATE game_plans SET stripe_price_id = $1 WHERE id = $2", [priceId, plan.id]);
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
    const url = await createCheckoutSession(customerId, priceId, `${origin}/billing?success=true`, `${origin}/game-servers/new`, {
      type: "GAME",
      planId,
      userId: req.user!.id,
    });
    return res.json({ url });
  }

  const planRes = await query("SELECT id, name, price_monthly, stripe_price_id FROM vm_plans WHERE id = $1 AND is_active = true", [planId]);
  const plan = planRes.rows[0];
  if (!plan) return res.status(404).json({ error: "Plan introuvable" });
  let priceId = plan.stripe_price_id as string | null;
  if (!priceId) {
    priceId = await createProductAndPrice(plan.name, Number(plan.price_monthly));
    await query("UPDATE vm_plans SET stripe_price_id = $1 WHERE id = $2", [priceId, plan.id]);
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
  const url = await createCheckoutSession(customerId, priceId, `${origin}/billing?success=true`, `${origin}/vms/new/${planId}`, {
    type: "VPS",
    planId,
    userId: req.user!.id,
  });
  return res.json({ url });
});

router.post("/portal", requireAuth, async (req, res) => {
  const userRes = await query("SELECT stripe_customer_id FROM users WHERE id = $1", [req.user!.id]);
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

  if (event.type === "customer.subscription.created") {
    const sub = event.data.object as Stripe.Subscription;
    const meta = sub.metadata || {};
    const type = meta.type as string | undefined;
    const planId = meta.planId as string | undefined;
    const userId = meta.userId as string | undefined;

    if (type === "VPS" && planId && userId) {
      const planRes = await query("SELECT * FROM vm_plans WHERE id = $1", [planId]);
      const plan = planRes.rows[0];
      if (!plan) return res.json({ ok: true });

      await query(
        `INSERT INTO subscriptions (stripe_sub_id, status, current_period_start, current_period_end, cancel_at_period_end, user_id, plan_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          sub.id,
          sub.status,
          new Date(sub.current_period_start * 1000),
          new Date(sub.current_period_end * 1000),
          sub.cancel_at_period_end,
          userId,
          planId,
        ]
      );

      try {
        const nodeRes = await query("SELECT * FROM nodes WHERE is_active = true ORDER BY created_at ASC LIMIT 1");
        const node = nodeRes.rows[0];
        if (!node) return res.json({ ok: true });

        const proxmox = createProxmoxClient({
          host: node.host,
          port: node.port,
          username: node.username,
          password: node.password,
          realm: node.realm,
          sslVerify: node.ssl_verify,
        });

        const storage = node.template_storage || process.env.PROXMOX_STORAGE || "SAN1";
        const vmid = 5000 + Math.floor(Math.random() * 10000);

        if (plan.type === "LXC") {
          await proxmox.createLXC(node.name, {
            vmid,
            hostname: plan.name.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 20),
            ostemplate: meta.os || node.lxc_template_default,
            cores: plan.cpu,
            memory: plan.ram_mb,
            rootfs: `${storage}:${plan.disk_gb}`,
            net0: "name=eth0,bridge=PUBLIC,ip=dhcp",
            start: true,
            password: meta.rootPassword || undefined,
          });
        } else {
          const templateVmid = meta.os ? Number(meta.os) : (node.kvm_template_vmid || 113);
          const upid = await proxmox.cloneKVMTemplate(node.name, templateVmid, {
            newid: vmid,
            name: plan.name.toLowerCase().slice(0, 20),
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

        await query(
          `INSERT INTO vms (vmid, name, type, status, os, user_id, node_id, plan_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            vmid,
            plan.name,
            plan.type,
            "RUNNING",
            meta.os || null,
            userId,
            node.id,
            planId,
          ]
        );
      } catch {
        // ignore provisioning error for now
      }
    }

    if (type === "GAME" && planId && userId) {
      await query(
        `INSERT INTO game_subscriptions (stripe_sub_id, status, current_period_start, current_period_end, cancel_at_period_end, user_id, plan_id, pending_plan_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          sub.id,
          sub.status,
          new Date(sub.current_period_start * 1000),
          new Date(sub.current_period_end * 1000),
          sub.cancel_at_period_end,
          userId,
          planId,
          planId,
        ]
      );

      try {
        const panelRes = await query("SELECT url, api_key FROM ptero_panels ORDER BY created_at DESC LIMIT 1");
        const panel = panelRes.rows[0];
        if (!panel) return res.json({ ok: true });

        const planRes = await query("SELECT * FROM game_plans WHERE id = $1", [planId]);
        const plan = planRes.rows[0];
        if (!plan) return res.json({ ok: true });

        const client = createPteroAppClient(panel.url, panel.api_key);
        const payload = {
          name: `${plan.name} - ${userId}`,
          user: 1,
          egg: plan.ptero_egg_id,
          docker_image: plan.ptero_docker_image,
          startup: plan.ptero_startup,
          environment: plan.ptero_env_json ? JSON.parse(plan.ptero_env_json) : {},
          limits: plan.ptero_limits_json ? JSON.parse(plan.ptero_limits_json) : {
            memory: plan.ram_mb,
            swap: 0,
            disk: plan.disk_mb,
            io: 500,
            cpu: plan.cpu,
          },
          feature_limits: plan.ptero_feature_limits_json ? JSON.parse(plan.ptero_feature_limits_json) : {
            databases: plan.databases,
            backups: plan.backups,
            allocations: 1,
          },
          allocation: { default: plan.ptero_allocation_id },
        };
        const created = (await client.createServer(payload)) as any;
        await query(
          `INSERT INTO game_servers (name, status, ptero_server_id, user_id, plan_id)
           VALUES ($1,$2,$3,$4,$5)`,
          [plan.name, "RUNNING", created?.attributes?.id ?? null, userId, planId]
        );
      } catch {
        // ignore provisioning error
      }
    }
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    const userRes = await query("SELECT id FROM users WHERE stripe_customer_id = $1", [invoice.customer as string]);
    const user = userRes.rows[0];
    if (user) {
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
    }
  }

  return res.json({ received: true });
});

export default router;
