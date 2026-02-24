"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Server,
  CreditCard,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  Package,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { getApiBaseUrl } from "@/lib/api";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const clientNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Mes services", href: "/services", icon: Package },
  { label: "Commander", href: "/order", icon: ShoppingCart },
  { label: "Panier", href: "/cart", icon: ShoppingCart },
  { label: "Facturation", href: "/billing", icon: CreditCard },
];

interface SidebarProps {
  isAdmin?: boolean;
  userName?: string | null;
  userEmail?: string | null;
}

export function Sidebar({ isAdmin, userName, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const handleLogout = async () => {
    await fetch(`${getApiBaseUrl()}/auth/logout`, { method: "POST", credentials: "include" });
    window.location.href = "/login";
  };

  const initials =
    userName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "U";

  return (
    <aside
      className={cn(
        "relative flex flex-col h-full bg-card border-r border-border transition-all duration-300 ease-in-out",
        collapsed ? "w-[60px]" : "w-[240px]"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center h-[60px] border-b border-border flex-shrink-0",
          collapsed ? "justify-center px-0" : "px-5 gap-3"
        )}
      >
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-md shadow-primary/25">
          <Server className="w-4 h-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="font-display text-[15px] font-bold tracking-tight truncate">ProxPanel</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {clientNav.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            active={pathname === item.href || pathname.startsWith(item.href + "/")}
            collapsed={collapsed}
          />
        ))}

        {isAdmin && (
          <>
            <div className="my-3 mx-1 h-px bg-border" />
            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-xs font-semibold tracking-wide transition-all duration-150",
                "text-primary/80 hover:text-primary hover:bg-primary/8",
                collapsed && "justify-center px-0"
              )}
              title={collapsed ? "Panel Admin" : undefined}
            >
              <Shield className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span className="uppercase tracking-wider">Admin</span>}
            </Link>
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-border flex-shrink-0">
        {!collapsed && (
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-primary">{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate leading-tight">{userName ?? "Utilisateur"}</p>
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
            </div>
          </div>
        )}
        <div className={cn("px-2 pb-3", collapsed && "flex justify-center pt-2")}>
          <button
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-all duration-150 w-full",
              collapsed && "justify-center px-0 w-10"
            )}
            onClick={handleLogout}
            title={collapsed ? "Déconnexion" : undefined}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span>Déconnexion</span>}
          </button>
        </div>
      </div>

      {/* Toggle button */}
      <button
        className="absolute -right-3 top-[72px] z-20 w-6 h-6 rounded-full border border-border bg-card flex items-center justify-center shadow-sm hover:border-primary/40 hover:text-primary transition-all"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronLeft className="h-3 w-3 text-muted-foreground" />
        )}
      </button>
    </aside>
  );
}

function NavItem({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
        collapsed && "justify-center px-0 w-10 mx-auto"
      )}
      title={collapsed ? item.label : undefined}
    >
      <item.icon
        className={cn(
          "h-4 w-4 flex-shrink-0 transition-colors",
          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
        )}
      />
      {!collapsed && item.label}
    </Link>
  );
}
