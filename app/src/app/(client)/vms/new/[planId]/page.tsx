import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ConfigureVMForm } from "@/components/vms/configure-vm-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, Server } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import type { OsOption } from "@/components/vms/configure-vm-form";
import { serverFetch } from "@/lib/server-api";

function fmtRam(mb: number) {
  return mb >= 1024 ? `${mb / 1024} Go` : `${mb} Mo`;
}
function fmtBandwidth(gb: number | null | undefined) {
  if (!gb) return "Illimitée";
  return gb >= 1000 ? `${gb / 1000} To` : `${gb} Go`;
}

export default async function ConfigureVMPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;

  const session = await auth();
  if (!session) redirect("/login");

  const res = await serverFetch(`/vms/plans/${planId}/provision`);
  if (!res.ok) notFound();
  const data = await res.json();
  const plan = data.plan;
  const hasNodes = data.hasNodes as boolean;
  const lxcOsOptions = data.lxcOsOptions as OsOption[];
  const kvmOsOptions = data.kvmOsOptions as OsOption[];

  const stripeReady =
    !!plan.stripePriceId &&
    !!process.env.STRIPE_SECRET_KEY &&
    !process.env.STRIPE_SECRET_KEY.includes("placeholder");

  return (
    <div className="max-w-5xl animate-in space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/vms/new"
          className="h-9 w-9 flex items-center justify-center rounded-lg border border-border hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Configurer votre VPS</h1>
          <p className="text-sm text-muted-foreground">
            Plan sélectionné :{" "}
            <span className="font-medium text-foreground">{plan.name}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form (2/3) */}
        <div className="lg:col-span-2">
          <ConfigureVMForm
            planId={plan.id}
            planType={plan.type}
            hasNodes={hasNodes}
            stripeReady={stripeReady}
            lxcOsOptions={lxcOsOptions}
            kvmOsOptions={kvmOsOptions}
          />
        </div>

        {/* Order Summary (1/3) */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="h-4 w-4" />
                Résumé de commande
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-semibold">{plan.name}</p>
                <Badge variant="secondary" className="mt-1 text-xs">
                  {plan.type}
                </Badge>
              </div>

              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>{plan.cpu} vCPU</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>{fmtRam(plan.ramMb)} RAM DDR4</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>{plan.diskGb} Go SSD NVMe</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>{fmtBandwidth(plan.bandwidthGb)} bande passante</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>IP dédiée · Accès root</span>
                </li>
              </ul>

              <div className="pt-3 border-t border-border">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Total mensuel</span>
                  <div className="text-right">
                    <span className="text-2xl font-bold">
                      {formatCurrency(plan.priceMonthly)}
                    </span>
                    <span className="text-muted-foreground text-sm">/mois</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Résiliable à tout moment
                </p>
              </div>
            </CardContent>
          </Card>

          {!hasNodes && (
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400">
              ⚠️ Aucun nœud Proxmox actif. Configurez un nœud dans{" "}
              <Link href="/admin/nodes" className="underline">
                /admin/nodes
              </Link>{" "}
              avant de commander.
            </div>
          )}

          {!stripeReady && (
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">
              ℹ️ Mode développement — Stripe non configuré. La commande sera traitée
              directement sans paiement.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
