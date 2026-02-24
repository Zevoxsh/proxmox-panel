import { serverFetch } from "@/lib/server-api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, ChevronRight, Zap, Server } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

function fmtRam(mb: number) {
  return mb >= 1024 ? `${mb / 1024} Go` : `${mb} Mo`;
}
function fmtBandwidth(gb: number | null | undefined) {
  if (!gb) return "Illimitée";
  return gb >= 1000 ? `${gb / 1000} To` : `${gb} Go`;
}

type Plan = {
  id: string;
  name: string;
  description: string | null;
  cpu: number;
  ramMb: number;
  diskGb: number;
  bandwidthGb?: number | null;
  priceMonthly: number;
  type: string;
};

function PlanCard({ plan, popular = false }: { plan: Plan; popular?: boolean }) {
  return (
    <Card
      className={[
        "relative flex flex-col transition-all hover:shadow-md",
        popular
          ? "border-primary ring-1 ring-primary shadow-md shadow-primary/10"
          : "hover:border-primary/50",
      ].join(" ")}
    >
      {popular && (
        <div className="absolute -top-3 inset-x-0 flex justify-center">
          <Badge className="px-3 py-0.5 text-xs">⭐ Populaire</Badge>
        </div>
      )}
      <CardHeader className={popular ? "pt-7 pb-3" : "pb-3"}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{plan.name}</CardTitle>
            {plan.description && (
              <CardDescription className="mt-1">{plan.description}</CardDescription>
            )}
          </div>
          <Badge variant="secondary" className="text-xs shrink-0">
            {plan.type}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col flex-1">
        {/* Price */}
        <div className="mb-5">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold">{formatCurrency(plan.priceMonthly)}</span>
            <span className="text-muted-foreground text-sm">/mois</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sans engagement · Résiliable à tout moment
          </p>
        </div>

        {/* Specs */}
        <ul className="space-y-2.5 flex-1 mb-6 text-sm">
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary shrink-0" />
            <span>
              <strong>{plan.cpu} vCPU</strong>
            </span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary shrink-0" />
            <span>
              <strong>{fmtRam(plan.ramMb)}</strong> RAM DDR4
            </span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary shrink-0" />
            <span>
              <strong>{plan.diskGb} Go</strong> SSD NVMe
            </span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary shrink-0" />
            <span>
              <strong>{fmtBandwidth(plan.bandwidthGb)}</strong> bande passante
            </span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary shrink-0" />
            <span>IP dédiée · Accès root complet</span>
          </li>
        </ul>

        <Button asChild className="w-full" variant={popular ? "default" : "outline"}>
          <Link href={`/vms/new/${plan.id}`}>
            Commander <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default async function NewVMPage() {
  const res = await serverFetch("/vms/plans");
  const plans: Plan[] = res.ok ? await res.json() : [];

  const lxcPlans = plans.filter((p) => p.type === "LXC");
  const kvmPlans = plans.filter((p) => p.type === "KVM");

  return (
    <div className="space-y-10 animate-in">
      <div>
        <h1 className="text-3xl font-bold">Commander un VPS</h1>
        <p className="text-muted-foreground mt-1">
          Déployez votre serveur en quelques minutes · Payez au mois sans engagement
        </p>
      </div>

      {lxcPlans.length > 0 && (
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Conteneurs LXC</h2>
              <p className="text-sm text-muted-foreground">
                Légers, rapides · Idéal pour apps web, bases de données et scripts
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {lxcPlans.map((plan, i) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                popular={lxcPlans.length > 1 && i === 1}
              />
            ))}
          </div>
        </section>
      )}

      {kvmPlans.length > 0 && (
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Server className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Serveurs KVM</h2>
              <p className="text-sm text-muted-foreground">
                Virtualisation complète · OS dédié · Isolation totale
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {kvmPlans.map((plan, i) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                popular={kvmPlans.length > 1 && i === 1}
              />
            ))}
          </div>
        </section>
      )}

      {plans.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <Server className="h-14 w-14 mx-auto mb-4 opacity-20" />
          <p className="font-medium">Aucun plan disponible pour le moment.</p>
          <p className="text-sm mt-1">Contactez l&apos;administrateur.</p>
        </div>
      )}
    </div>
  );
}
