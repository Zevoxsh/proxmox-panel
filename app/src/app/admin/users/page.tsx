import { serverFetch } from "@/lib/server-api";
import { formatDate } from "@/lib/utils";
import { Users, ShieldCheck, User } from "lucide-react";

type AdminUser = {
  id: string;
  email: string;
  name?: string | null;
  role: "USER" | "ADMIN";
  createdAt: string;
  stripeCustomerId?: string | null;
  _count: { vms: number; subscriptions: number };
};

export default async function AdminUsersPage() {
  const res = await serverFetch("/admin/users");
  const data = res.ok ? await res.json() : { users: [] };
  const users = (data.users ?? []) as AdminUser[];

  return (
    <div className="space-y-5 animate-in">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-1">Administration</p>
        <h1 className="font-display text-2xl font-bold">Utilisateurs</h1>
        <p className="text-sm text-muted-foreground mt-1">{users.length} compte(s) enregistrés</p>
      </div>

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60">
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Utilisateur
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Rôle
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                VMs
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                Abonnements
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                Stripe ID
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden xl:table-cell">
                Inscrit le
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-accent/30 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{user.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      user.role === "ADMIN"
                        ? "bg-primary/12 text-primary"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    <ShieldCheck className="h-3 w-3" />
                    {user.role}
                  </span>
                </td>
                <td className="px-5 py-3.5 hidden md:table-cell">
                  <span className="font-mono text-sm">{user._count.vms}</span>
                </td>
                <td className="px-5 py-3.5 hidden lg:table-cell">
                  <span className="font-mono text-sm">{user._count.subscriptions}</span>
                </td>
                <td className="px-5 py-3.5 hidden lg:table-cell">
                  <span className="text-xs text-muted-foreground font-mono">
                    {user.stripeCustomerId
                      ? user.stripeCustomerId.slice(0, 14) + "…"
                      : "—"}
                  </span>
                </td>
                <td className="px-5 py-3.5 hidden xl:table-cell text-xs text-muted-foreground">
                  {formatDate(new Date(user.createdAt))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
