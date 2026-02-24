"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShoppingCart, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/lib/api";

export interface OsOption {
  id: string;
  label: string;
  version?: string;
  emoji?: string;
}

interface Props {
  planId: string;
  planType: string;
  hasNodes: boolean;
  stripeReady: boolean;
  lxcOsOptions: OsOption[];
  kvmOsOptions: OsOption[];
}

export function ConfigureVMForm({
  planId,
  planType,
  hasNodes,
  stripeReady,
  lxcOsOptions,
  kvmOsOptions,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const osList = planType === "LXC" ? lxcOsOptions : kvmOsOptions;
  const [selectedOS, setSelectedOS] = useState(osList[0]?.id ?? "");
  const [rootPassword, setRootPassword] = useState("");

  const handleOrder = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/vms/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          planId,
          os: selectedOS || undefined,
          rootPassword: rootPassword || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Erreur lors de la commande", {
          description: data.hint,
          duration: 8000,
        });
      } else if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        if (data.warning) toast.warning(data.warning);
        else toast.success("VPS en cours de déploiement !");
        router.push(`/vms/${data.vmId}`);
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* OS Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Système d&apos;exploitation</CardTitle>
        </CardHeader>
        <CardContent>
          {osList.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Aucun template disponible sur ce nœud. Contactez l&apos;administrateur.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {osList.map((os) => (
                <button
                  key={os.id}
                  type="button"
                  onClick={() => setSelectedOS(os.id)}
                  className={cn(
                    "relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all text-center hover:bg-accent",
                    selectedOS === os.id ? "border-primary bg-primary/5" : "border-border"
                  )}
                >
                  {osList[0]?.id === os.id && (
                    <span className="absolute top-1.5 right-1.5 text-[9px] font-semibold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full leading-tight">
                      Recommandé
                    </span>
                  )}
                  <span className="text-2xl">{os.emoji ?? "🧩"}</span>
                  <div>
                    <p className="text-sm font-semibold leading-tight">{os.label}</p>
                    {os.version && (
                      <p className="text-xs text-muted-foreground leading-tight mt-0.5 line-clamp-1" title={os.version}>
                        {os.version}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Server Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuration du serveur</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">
              Mot de passe root{" "}
              <span className="text-muted-foreground font-normal">(optionnel)</span>
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Généré automatiquement si vide"
              value={rootPassword}
              onChange={(e) => setRootPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Si vide, un mot de passe sécurisé sera généré et affiché après déploiement.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <Button
        onClick={handleOrder}
        className="w-full"
        size="lg"
        disabled={loading || osList.length === 0}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {stripeReady ? "Redirection vers le paiement..." : "Déploiement en cours..."}
          </>
        ) : stripeReady ? (
          <>
            <CreditCard className="mr-2 h-4 w-4" />
            Payer &amp; Commander
          </>
        ) : (
          <>
            <ShoppingCart className="mr-2 h-4 w-4" />
            Commander le VPS
          </>
        )}
      </Button>
    </div>
  );
}
