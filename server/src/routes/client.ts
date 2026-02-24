import { Router } from "express";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/dashboard", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const [
    vmsRes,
    gameRes,
    subscriptionRes,
    invoicesRes,
    totalVMsRes,
    totalGameRes,
  ] = await Promise.all([
    query<{
      id: string;
      name: string;
      status: string;
      vmid: number;
      type: string;
      ip: string | null;
      plan_name: string;
      node_name: string;
    }>(
      `SELECT v.id, v.name, v.status, v.vmid, v.type, v.ip,
              p.name AS plan_name,
              n.name AS node_name
       FROM vms v
       JOIN vm_plans p ON p.id = v.plan_id
       JOIN nodes n ON n.id = v.node_id
       WHERE v.user_id = $1
       ORDER BY v.created_at DESC
       LIMIT 5`,
      [userId]
    ),
    query<{
      id: string;
      name: string;
      status: string;
      plan_name: string;
      plan_game: string;
    }>(
      `SELECT g.id, g.name, g.status,
              p.name AS plan_name,
              p.game AS plan_game
       FROM game_servers g
       JOIN game_plans p ON p.id = g.plan_id
       WHERE g.user_id = $1
       ORDER BY g.created_at DESC
       LIMIT 4`,
      [userId]
    ),
    query<{
      id: string;
      status: string;
      current_period_end: string;
      cancel_at_period_end: boolean;
      plan_name: string;
      plan_cpu: number;
      plan_ram_mb: number;
      plan_disk_gb: number;
      plan_price: string;
    }>(
      `SELECT s.id, s.status, s.current_period_end, s.cancel_at_period_end,
              p.name AS plan_name,
              p.cpu AS plan_cpu,
              p.ram_mb AS plan_ram_mb,
              p.disk_gb AS plan_disk_gb,
              p.price_monthly AS plan_price
       FROM subscriptions s
       JOIN vm_plans p ON p.id = s.plan_id
       WHERE s.user_id = $1 AND s.status IN ('ACTIVE','TRIALING','PAST_DUE')
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [userId]
    ),
    query<{
      id: string;
      amount: string;
      currency: string;
      status: string;
      created_at: string;
    }>(
      `SELECT id, amount, currency, status, created_at
       FROM invoices
       WHERE user_id = $1 AND status = 'PAID'
       ORDER BY created_at DESC
       LIMIT 3`,
      [userId]
    ),
    query<{ count: string }>("SELECT COUNT(*)::int AS count FROM vms WHERE user_id = $1", [userId]),
    query<{ count: string }>("SELECT COUNT(*)::int AS count FROM game_servers WHERE user_id = $1", [userId]),
  ]);

  const vms = vmsRes.rows.map((v) => ({
    id: v.id,
    name: v.name,
    status: v.status,
    vmid: v.vmid,
    type: v.type,
    ip: v.ip,
    plan: { name: v.plan_name },
    node: { name: v.node_name },
  }));

  const gameServers = gameRes.rows.map((g) => ({
    id: g.id,
    name: g.name,
    status: g.status,
    plan: { name: g.plan_name, game: g.plan_game },
  }));

  const subscriptionRow = subscriptionRes.rows[0];
  const subscription = subscriptionRow
    ? {
        id: subscriptionRow.id,
        status: subscriptionRow.status,
        currentPeriodEnd: subscriptionRow.current_period_end,
        cancelAtPeriodEnd: subscriptionRow.cancel_at_period_end,
        plan: {
          name: subscriptionRow.plan_name,
          cpu: subscriptionRow.plan_cpu,
          ramMb: subscriptionRow.plan_ram_mb,
          diskGb: subscriptionRow.plan_disk_gb,
          priceMonthly: Number(subscriptionRow.plan_price),
        },
      }
    : null;

  const invoices = invoicesRes.rows.map((i) => ({
    id: i.id,
    amount: Number(i.amount),
    currency: i.currency,
    status: i.status,
    createdAt: i.created_at,
  }));

  const totalVMs = Number(totalVMsRes.rows[0]?.count ?? 0);
  const totalGameServers = Number(totalGameRes.rows[0]?.count ?? 0);
  const runningCount = vms.filter((v) => v.status === "RUNNING").length;
  const runningGameServers = gameServers.filter((s) => s.status === "RUNNING").length;

  return res.json({
    vms,
    gameServers,
    subscription,
    invoices,
    totalVMs,
    totalGameServers,
    runningCount,
    runningGameServers,
  });
});

router.get("/billing", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const [subscriptionRes, invoicesRes] = await Promise.all([
    query<{
      id: string;
      status: string;
      current_period_end: string;
      cancel_at_period_end: boolean;
      plan_name: string;
      plan_cpu: number;
      plan_ram_mb: number;
      plan_disk_gb: number;
      plan_price: string;
    }>(
      `SELECT s.id, s.status, s.current_period_end, s.cancel_at_period_end,
              p.name AS plan_name,
              p.cpu AS plan_cpu,
              p.ram_mb AS plan_ram_mb,
              p.disk_gb AS plan_disk_gb,
              p.price_monthly AS plan_price
       FROM subscriptions s
       JOIN vm_plans p ON p.id = s.plan_id
       WHERE s.user_id = $1 AND s.status IN ('ACTIVE','TRIALING','PAST_DUE')
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [userId]
    ),
    query<{
      id: string;
      amount: string;
      currency: string;
      status: string;
      created_at: string;
      pdf_url: string | null;
      hosted_url: string | null;
    }>(
      `SELECT id, amount, currency, status, created_at, pdf_url, hosted_url
       FROM invoices
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    ),
  ]);

  const s = subscriptionRes.rows[0];
  const subscription = s
    ? {
        id: s.id,
        status: s.status,
        currentPeriodEnd: s.current_period_end,
        cancelAtPeriodEnd: s.cancel_at_period_end,
        plan: {
          name: s.plan_name,
          cpu: s.plan_cpu,
          ramMb: s.plan_ram_mb,
          diskGb: s.plan_disk_gb,
          priceMonthly: Number(s.plan_price),
        },
      }
    : null;

  const invoices = invoicesRes.rows.map((i) => ({
    id: i.id,
    amount: Number(i.amount),
    currency: i.currency,
    status: i.status,
    createdAt: i.created_at,
    pdfUrl: i.pdf_url,
    hostedUrl: i.hosted_url,
  }));

  return res.json({ subscription, invoices });
});

router.get("/plans", requireAuth, async (_req, res) => {
  const plansRes = await query<{
    id: string;
    name: string;
    description: string | null;
    cpu: number;
    ram_mb: number;
    disk_gb: number;
    price_monthly: string;
    type: string;
    is_active: boolean;
  }>(
    `SELECT id, name, description, cpu, ram_mb, disk_gb, price_monthly, type, is_active
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
    priceMonthly: Number(p.price_monthly),
    type: p.type,
    isActive: p.is_active,
  }));

  return res.json(plans);
});

export default router;
