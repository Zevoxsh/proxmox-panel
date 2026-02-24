"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, CreditCard, Settings, ShoppingBag, Server } from "lucide-react";
import { getApiBaseUrl } from "../lib/api";

const nav = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Mes services", href: "/services", icon: Package },
  { label: "Commander", href: "/order", icon: ShoppingBag },
  { label: "Facturation", href: "/billing", icon: CreditCard },
  { label: "Admin", href: "/admin", icon: Settings },
];

export function Sidebar({ userName }: { userName?: string | null }) {
  const pathname = usePathname();

  const logout = async () => {
    await fetch(`${getApiBaseUrl()}/auth/logout`, { method: "POST", credentials: "include" });
    window.location.href = "/login";
  };

  return (
    <aside className="w-64 border-r border-border bg-card min-h-screen p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        <div className="h-9 w-9 rounded-lg bg-primary/20 flex items-center justify-center">
          <Server className="h-5 w-5 text-primary" />
        </div>
        <div className="font-display text-lg">ProxPanel</div>
      </div>
      <nav className="space-y-1 flex-1">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                active ? "bg-white/5 text-white" : "text-muted hover:bg-white/5"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border pt-4 text-sm text-muted">
        <div className="mb-2">{userName ?? "Utilisateur"}</div>
        <button className="btn btn-outline w-full" onClick={logout}>Déconnexion</button>
      </div>
    </aside>
  );
}
