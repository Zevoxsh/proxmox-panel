import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { createCheckoutSession, createOrRetrieveCustomer, createProductAndPrice } from "../lib/stripe.js";

const router = Router();

const orderSchema = z.object({
  planId: z.string(),
  name: z.string().min(2).max(32),
});

router.get("/plans", requireAuth, async (_req, res) => {
  const plansRes = await query("SELECT * FROM game_plans WHERE is_active = true ORDER BY price_monthly ASC");
  return res.json(plansRes.rows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    game: p.game,
    cpu: p.cpu,
    ramMb: p.ram_mb,
    diskMb: p.disk_mb,
    databases: p.databases,
    backups: p.backups,
    priceMonthly: Number(p.price_monthly),
  })));
});

router.get("/", requireAuth, async (req, res) => {
  const data = await query(
    `SELECT gs.*, gp.name AS plan_name, gp.game
     FROM game_servers gs
     JOIN game_plans gp ON gp.id = gs.plan_id
     WHERE gs.user_id = $1
     ORDER BY gs.created_at DESC`,
    [req.user!.id]
  );
  return res.json(data.rows);
});

router.post("/order", requireAuth, async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Données invalides" });
  const { planId, name } = parsed.data;

  const planRes = await query(
    `SELECT id, name, price_monthly, stripe_price_id FROM game_plans WHERE id = $1 AND is_active = true`,
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
        await query("UPDATE game_plans SET stripe_price_id = $1 WHERE id = $2", [priceId, plan.id]);
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
    const url = await createCheckoutSession(customerId, priceId!, `${origin}/billing?success=true`, `${origin}/game-servers/new`, {
      type: "GAME",
      planId,
      name,
      userId: req.user!.id,
    });
    return res.json({ checkoutUrl: url });
  }

  return res.status(400).json({ error: "Stripe non configuré" });
});

export default router;
