import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Shield, Users, Cpu, Network, BarChart3, Gamepad2, Swords, ArrowLeft, Layers } from "lucide-react";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="min-h-screen theme-admin bg-background text-foreground">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-[600px] h-[300px] bg-primary/6 rounded-full blur-[120px]" />
      </div>

      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 h-[60px]">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground leading-none mb-0.5">
                Admin
              </p>
              <p className="font-display text-sm font-bold leading-none">ProxPanel</p>
            </div>
          </div>

          {/* Nav desktop */}
          <nav className="hidden items-center gap-1 md:flex">
            <AdminNavLink href="/admin" label="Aperçu" icon={BarChart3} />
            <AdminNavLink href="/admin/users" label="Utilisateurs" icon={Users} />
            <AdminNavLink href="/admin/nodes" label="Nodes" icon={Network} />
            <AdminNavLink href="/admin/vms" label="VMs" icon={Cpu} />
            <AdminNavLink href="/admin/vm-plans" label="Plans VPS" icon={Layers} />
            <AdminNavLink href="/admin/ptero" label="Gaming" icon={Swords} />
            <AdminNavLink href="/admin/game-plans" label="Offres" icon={Gamepad2} />
          </nav>

          {/* User + back */}
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{session.user.name ?? "Admin"}</p>
              <p className="text-xs text-muted-foreground">{session.user.email}</p>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border transition-all"
            >
              <ArrowLeft className="h-3 w-3" />
              Client
            </Link>
          </div>
        </div>

        {/* Nav mobile */}
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6 pb-3 md:hidden">
          <AdminNavLink href="/admin" label="Aperçu" icon={BarChart3} compact />
          <AdminNavLink href="/admin/users" label="Users" icon={Users} compact />
          <AdminNavLink href="/admin/nodes" label="Nodes" icon={Network} compact />
          <AdminNavLink href="/admin/vms" label="VMs" icon={Cpu} compact />
          <AdminNavLink href="/admin/vm-plans" label="Plans" icon={Layers} compact />
          <AdminNavLink href="/admin/ptero" label="Gaming" icon={Swords} compact />
          <AdminNavLink href="/admin/game-plans" label="Offres" icon={Gamepad2} compact />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}

function AdminNavLink({
  href,
  label,
  icon: Icon,
  compact,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all",
        compact && "px-2 py-1"
      )}
    >
      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      <span>{label}</span>
    </Link>
  );
}
