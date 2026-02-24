import { serverFetch } from "@/lib/server-api";
import { Card, CardContent } from "@/components/ui/card";
import { AddGamePlanForm } from "@/components/admin/add-game-plan-form";
import { GameIcon } from "@/components/game-servers/game-icon";
import { formatBytes, formatCurrency } from "@/lib/utils";
import { Gamepad2, ShieldCheck } from "lucide-react";

type GamePlan = {
  id: string;
  name: string;
  description?: string | null;
  game: string;
  cpu: number;
  ramMb: number;
  diskMb: number;
  databases: number;
  backups: number;
  allocations: number;
  priceMonthly: number;
  nestId: number;
  eggId: number;
  isActive: boolean;
  panel: { id: string; name: string };
  _count: { servers: number };
};

type Panel = { id: string; name: string; url: string; isActive: boolean };

export default async function AdminGamePlansPage() {
  const [plansRes, panelsRes] = await Promise.all([
    serverFetch("/admin/game-plans"),
    serverFetch("/admin/ptero/panels"),
  ]);
  const plans = (plansRes.ok ? await plansRes.json() : []) as GamePlan[];
  const panelsAll = (panelsRes.ok ? await panelsRes.json() : []) as Panel[];
  const panels = panelsAll.filter((p) => p.isActive);

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Gaming Cloud</p>
          <h1 className="font-display text-3xl font-semibold">Offres Gaming</h1>
          <p className="text-muted-foreground mt-2">{plans.length} offre(s) configurée(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-4 py-2 text-xs font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Catalogue premium
          </span>
          <AddGamePlanForm panels={panels} />
        </div>
      </div>

      {plans.length === 0 ? (
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Gamepad2 className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucune offre gaming créée</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <Card key={plan.id} className={`border-border/70 bg-card/80 shadow-sm ${plan.isActive ? "" : "opacity-60"}`}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3 mb-4">
                  <GameIcon game={plan.game} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{plan.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{plan.game}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-display text-lg font-semibold text-primary">{formatCurrency(plan.priceMonthly)}</p>
                    <p className="text-xs text-muted-foreground">/mois</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground mb-3">
                  <span>{plan.cpu}% CPU</span>
                  <span>{formatBytes(plan.ramMb)} RAM</span>
                  <span>{(plan.diskMb / 1024).toFixed(0)} GB disque</span>
                  <span>{plan.databases} DB · {plan.backups} backups</span>
                </div>

                <div className="flex items-center justify-between text-xs border-t border-border/70 pt-3">
                  <span className="text-muted-foreground">
                    Nest {plan.nestId} / Egg {plan.eggId}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{plan._count.servers} serveurs</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      plan.isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {plan.isActive ? "Actif" : "Inactif"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
