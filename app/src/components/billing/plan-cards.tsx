"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cpu, MemoryStick, HardDrive, Network, Check, Loader2 } from "lucide-react";
import { formatBytes, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/lib/api";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  cpu: number;
  ramMb: number;
  diskGb: number;
  bandwidthGb: number | null;
  priceMonthly: number;
  type: string;
  stripePriceId: string | null;
}

export function PlanCards({ plans }: { plans: Plan[] }) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const lxcPlans = plans.filter((p) => p.type === "LXC");
  const kvmPlans = plans.filter((p) => p.type === "KVM");

  const handleSubscribe = async (plan: Plan) => {
    if (!plan.stripePriceId) {
      toast.error("Ce plan n'est pas encore disponible à la vente");
      return;
    }
    setLoadingPlan(plan.id);
    try {
      const res = await fetch(`${getApiBaseUrl()}/stripe/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ planId: plan.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur");
      } else {
        window.location.href = data.url;
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <Tabs defaultValue="LXC">
      <TabsList className="mb-6">
        <TabsTrigger value="LXC">Conteneurs LXC</TabsTrigger>
        <TabsTrigger value="KVM">VPS KVM</TabsTrigger>
      </TabsList>

      <TabsContent value="LXC">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lxcPlans.map((plan, i) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              featured={i === 1}
              loading={loadingPlan === plan.id}
              onSubscribe={handleSubscribe}
            />
          ))}
        </div>
      </TabsContent>

      <TabsContent value="KVM">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kvmPlans.map((plan, i) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              featured={i === 1}
              loading={loadingPlan === plan.id}
              onSubscribe={handleSubscribe}
            />
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}

function PlanCard({
  plan,
  featured,
  loading,
  onSubscribe,
}: {
  plan: Plan;
  featured: boolean;
  loading: boolean;
  onSubscribe: (plan: Plan) => void;
}) {
  return (
    <Card className={featured ? "border-primary shadow-lg shadow-primary/10 relative" : ""}>
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
            Populaire
          </span>
        </div>
      )}
      <CardHeader>
        <CardTitle>{plan.name}</CardTitle>
        <CardDescription>{plan.description}</CardDescription>
        <div className="flex items-baseline gap-1 pt-2">
          <span className="text-3xl font-bold">{formatCurrency(plan.priceMonthly)}</span>
          <span className="text-muted-foreground text-sm">/mois</span>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2.5">
          <FeatureRow icon={Cpu} label={`${plan.cpu} vCPU`} />
          <FeatureRow icon={MemoryStick} label={`${formatBytes(plan.ramMb)} RAM`} />
          <FeatureRow icon={HardDrive} label={`${plan.diskGb} GB SSD NVMe`} />
          {plan.bandwidthGb && (
            <FeatureRow icon={Network} label={`${plan.bandwidthGb >= 1000 ? `${plan.bandwidthGb / 1000} TB` : `${plan.bandwidthGb} GB`} bande passante`} />
          )}
          <FeatureRow icon={Check} label="IP dédiée" />
          <FeatureRow icon={Check} label="Sauvegarde hebdomadaire" />
          <FeatureRow icon={Check} label="Support 24/7" />
        </ul>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          variant={featured ? "default" : "outline"}
          onClick={() => onSubscribe(plan)}
          disabled={loading}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {plan.stripePriceId ? "Commander" : "Bientôt disponible"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function FeatureRow({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <Icon className="h-4 w-4 text-primary shrink-0" />
      <span>{label}</span>
    </li>
  );
}
