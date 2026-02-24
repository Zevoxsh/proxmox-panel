import { serverFetch } from "@/lib/server-api";
import { Card, CardContent } from "@/components/ui/card";
import { AddVmPlanForm } from "@/components/admin/add-vm-plan-form";
import { formatCurrency } from "@/lib/utils";
import { Cpu, Server } from "lucide-react";

type VmPlan = {
  id: string;
  name: string;
  description?: string | null;
  cpu: number;
  ramMb: number;
  diskGb: number;
  bandwidthGb?: number | null;
  priceMonthly: number;
  type: "LXC" | "KVM";
  isActive: boolean;
  _count: { vms: number };
};

export default async function AdminVmPlansPage() {
  const plansRes = await serverFetch("/admin/vm-plans");
  const plans = (plansRes.ok ? await plansRes.json() : []) as VmPlan[];

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">VPS Catalog</p>
          <h1 className="font-display text-3xl font-semibold">Plans VPS</h1>
          <p className="text-muted-foreground mt-2">{plans.length} plan(s) configuré(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-4 py-2 text-xs font-semibold">
            <Server className="h-4 w-4 text-primary" />
            Offres Proxmox
          </span>
          <AddVmPlanForm />
        </div>
      </div>

      {plans.length === 0 ? (
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Cpu className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucun plan VPS créé</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`border-border/70 bg-card/80 shadow-sm ${plan.isActive ? "" : "opacity-60"}`}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{plan.name}</p>
                    <p className="text-xs text-muted-foreground">{plan.description ?? plan.type}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-display text-lg font-semibold text-primary">
                      {formatCurrency(plan.priceMonthly)}
                    </p>
                    <p className="text-xs text-muted-foreground">/mois</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground mb-3">
                  <span>{plan.cpu} vCPU</span>
                  <span>{plan.ramMb} Mo RAM</span>
                  <span>{plan.diskGb} Go SSD</span>
                  <span>{plan.bandwidthGb ? `${plan.bandwidthGb} Go` : "Illimitée"}</span>
                </div>

                <div className="flex items-center justify-between text-xs border-t border-border/70 pt-3">
                  <span className="text-muted-foreground">{plan.type}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{plan._count.vms} VM(s)</span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        plan.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
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
