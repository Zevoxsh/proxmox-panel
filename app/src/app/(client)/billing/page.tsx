import { serverFetch } from "@/lib/server-api";
import { Button } from "@/components/ui/button";
import { BillingPortalButton } from "@/components/billing/billing-portal-button";
import { formatCurrency, formatDate, getStatusBg } from "@/lib/utils";
import { CreditCard, FileText, Plus, ExternalLink, Zap, Calendar, CheckCircle2 } from "lucide-react";
import Link from "next/link";

type BillingPlan = {
  name: string;
  cpu: number;
  ramMb: number;
  diskGb: number;
  priceMonthly: number;
};

type BillingSubscription = {
  status: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  plan: BillingPlan;
};

type BillingInvoice = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  pdfUrl?: string | null;
};

export default async function BillingPage() {
  const res = await serverFetch("/client/billing");
  const data = res.ok ? await res.json() : { subscription: null, invoices: [] };
  const { subscription, invoices } = data as {
    subscription: BillingSubscription | null;
    invoices: BillingInvoice[];
  };

  const invoiceStatusLabel: Record<string, string> = {
    PAID: "Payée",
    OPEN: "En attente",
    VOID: "Annulée",
  };

  return (
    <div className="space-y-5 animate-in max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-bold">Facturation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gérez vos abonnements et consultez vos factures
        </p>
      </div>

      {/* Abonnement actif */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border/50 flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            Abonnement actuel
          </h2>
          {subscription && <BillingPortalButton />}
        </div>

        <div className="px-5 py-5">
          {subscription ? (
            <div className="space-y-4">
              {/* Prix + plan */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-lg font-bold">{subscription.plan.name}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {subscription.plan.cpu} vCPU ·{" "}
                    {subscription.plan.ramMb / 1024} GB RAM ·{" "}
                    {subscription.plan.diskGb} GB SSD
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl font-bold text-primary">
                    {formatCurrency(subscription.plan.priceMonthly)}
                  </p>
                  <p className="text-xs text-muted-foreground">/mois</p>
                </div>
              </div>

              {/* Détails */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-secondary/40 px-3 py-2.5 flex items-center gap-2.5">
                  <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Prochaine facturation</p>
                    <p className="text-sm font-medium">{formatDate(new Date(subscription.currentPeriodEnd))}</p>
                  </div>
                </div>
                <div className="rounded-lg bg-secondary/40 px-3 py-2.5 flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Statut</p>
                    <p className="text-sm font-medium text-emerald-400">
                      {subscription.status === "ACTIVE" ? "Actif" : subscription.status}
                    </p>
                  </div>
                </div>
              </div>

              {subscription.cancelAtPeriodEnd && (
                <div className="rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2.5 text-sm text-amber-400 flex items-center gap-2">
                  <Zap className="h-4 w-4 flex-shrink-0" />
                  Annulation le {formatDate(new Date(subscription.currentPeriodEnd))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center border border-primary/15">
                <CreditCard className="h-7 w-7 text-primary/60" />
              </div>
              <div className="text-center">
                <p className="font-medium mb-1">Aucun abonnement actif</p>
                <p className="text-sm text-muted-foreground">Choisissez un plan pour commencer</p>
              </div>
              <Button asChild size="sm">
                <Link href="/billing/plans">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Choisir un plan
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Historique des factures */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border/50 flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Historique des factures
          </h2>
          <span className="text-xs font-mono text-muted-foreground">{invoices.length}</span>
        </div>

        {invoices.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-muted-foreground">Aucune facture pour le moment</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between px-5 py-3 hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {formatCurrency(invoice.amount, invoice.currency.toUpperCase())}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(new Date(invoice.createdAt))}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${getStatusBg(
                      invoice.status
                    )}`}
                  >
                    {invoiceStatusLabel[invoice.status] ?? invoice.status}
                  </span>
                  {invoice.pdfUrl && (
                    <a
                      href={invoice.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
