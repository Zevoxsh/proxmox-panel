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
  centos: { label: "CentOS", emoji: "🎩" },
  fedora: { label: "Fedora", emoji: "🎩" },
  archlinux: { label: "Arch Linux", emoji: "🔷" },
  rockylinux: { label: "Rocky Linux", emoji: "🪨" },
  almalinux: { label: "AlmaLinux", emoji: "🦣" },
  opensuse: { label: "openSUSE", emoji: "🦎" },
  gentoo: { label: "Gentoo", emoji: "⚙️" },
  turnkey: { label: "TurnKey", emoji: "🔑" },
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

  const planRes = await query<{
    id: string;
    name: string;
    description: string | null;
    cpu: number;
    ram_mb: number;
    disk_gb: number;
    bandwidth_gb: number | null;
    price_monthly: string;
    type: string;
    stripe_price_id: string | null;
  }>(
    "SELECT * FROM vm_plans WHERE id = $1 AND is_active = true",
    [planId]
  );
  const plan = planRes.rows[0];
  if (!plan) return res.status(404).json({ error: "Plan introuvable" });

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
    template_storage: string | null;
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
      const storage = process.env.PROXMOX_STORAGE || "SAN1";
      const lxcTemplates = await proxmox.getTemplates(node.name, storage);
      for (const t of lxcTemplates) {
        const { label, version, emoji } = parseLxcTemplate(t.volid);
        lxcOsOptions.push({ id: t.volid, label, version, emoji });
      }

      const kvmTemplates = await proxmox.getKVMTemplatesByIds(node.name, KVM_TEMPLATE_IDS);
      for (const t of kvmTemplates) {
        kvmOsOptions.push({ id: String(t.vmid), label: t.name, emoji: "🖥️" });
      }
    } catch {
      if (node.lxc_template_default) {
        const { label, version, emoji } = parseLxcTemplate(node.lxc_template_default);
        lxcOsOptions.push({ id: node.lxc_template_default, label, version, emoji });
      }
      for (const id of KVM_TEMPLATE_IDS) {
        kvmOsOptions.push({ id: String(id), label: `Template ${id}`, emoji: "🖥️" });
      }
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
