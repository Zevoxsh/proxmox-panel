import { Router } from "express";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const subs = await query(
    `SELECT s.*, p.name AS plan_name FROM subscriptions s
     JOIN vm_plans p ON p.id = s.plan_id
     WHERE s.user_id = $1 ORDER BY s.created_at DESC`,
    [req.user!.id]
  );
  const gameSubs = await query(
    `SELECT s.*, p.name AS plan_name FROM game_subscriptions s
     JOIN game_plans p ON p.id = s.plan_id
     WHERE s.user_id = $1 ORDER BY s.created_at DESC`,
    [req.user!.id]
  );
  const invoices = await query(
    "SELECT * FROM invoices WHERE user_id = $1 ORDER BY created_at DESC",
    [req.user!.id]
  );
  return res.json({ subscriptions: subs.rows, gameSubscriptions: gameSubs.rows, invoices: invoices.rows });
});

export default router;
