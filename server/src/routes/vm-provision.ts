import { Router } from "express";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { createProxmoxClient } from "../lib/proxmox.js";

const router = Router();

const KVM_TEMPLATE_IDS = [113, 119, 120, 121, 123];

const DISTRO_META: Record<string, { label: string; emoji: string }> = {
  debian: { label: "Debian", emoji: "🌀" },
  ubuntu: { label: "Ubuntu", emoji: "🟠" },
  alpine: { label: "Alpine", emoji: "🏔️" },
};

function parseLxcTemplate(volid: string): { label: string; version: string; emoji: string } {
  const filename = volid.split("/").pop() ?? volid;
  const clean = filename.replace(/\.tar\.(gz|xz|zst)$/i, "");
  const distroKey = Object.keys(DISTRO_META).find((k) => clean.toLowerCase().startsWith(k));
  const meta = distroKey ? DISTRO_META[distroKey] : null;
  const dashParts = clean.split("_")[0].split("-");
  const version = dashParts[1] ?? "";
  const label = meta ? `${meta.label} ${version}`.trim() : clean.replace(/[_-]/g, " ");
  const emoji = meta?.emoji ?? "📦";
  return { label, version: clean.replace(/_/g, " "), emoji };
}

router.get("/plans/:planId/provision", requireAuth, async (req, res) => {
  const planId = req.params.planId;
  const planRes = await query(
    "SELECT * FROM vm_plans WHERE id = $1 AND is_active = true",
    [planId]
  );
  const plan = planRes.rows[0];
  if (!plan) return res.status(404).json({ error: "Plan introuvable" });

  const nodesRes = await query("SELECT * FROM nodes WHERE is_active = true ORDER BY created_at ASC");
  const nodes = nodesRes.rows;
  const hasNodes = nodes.length > 0;
  const node = nodes[0];

  const lxcOsOptions: Array<{ id: string; label: string; version?: string; emoji?: string }> = [];
  const kvmOsOptions: Array<{ id: string; label: string; version?: string; emoji?: string }> = [];

  if (node) {
    try {
      const proxmox = createProxmoxClient({
        host: node.host,
        port: node.port,
        username: node.username,
        password: node.password,
        realm: node.realm,
        sslVerify: node.ssl_verify,
      });
      const storage = node.template_storage || process.env.PROXMOX_STORAGE || "SAN1";
      const lxcTemplates = await proxmox.getTemplates(node.name, storage);
      for (const t of lxcTemplates) {
        const { label, version, emoji } = parseLxcTemplate(t.volid);
        lxcOsOptions.push({ id: t.volid, label, version, emoji });
      }
      const kvmTemplates = await proxmox.getKVMTemplatesByIds(node.name, KVM_TEMPLATE_IDS);
      for (const t of kvmTemplates) kvmOsOptions.push({ id: String(t.vmid), label: t.name, emoji: "🖥️" });
    } catch {
      // fallback empty
    }
  }

  return res.json({
    plan: {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      cpu: plan.cpu,
      ramMb: plan.ram_mb,
      diskGb: plan.disk_gb,
      bandwidthGb: plan.bandwidth_gb,
      priceMonthly: Number(plan.price_monthly),
      type: plan.type,
      stripePriceId: plan.stripe_price_id,
    },
    hasNodes,
    lxcOsOptions,
    kvmOsOptions,
  });
});

export default router;
