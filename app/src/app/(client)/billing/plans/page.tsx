import { serverFetch } from "@/lib/server-api";
import { PlanCards } from "@/components/billing/plan-cards";

export default async function PlansPage() {
  const res = await serverFetch("/client/plans");
  const plans = res.ok ? await res.json() : [];

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-3xl font-bold">Choisir un plan</h1>
        <p className="text-muted-foreground mt-1">Sélectionnez la configuration qui correspond à vos besoins</p>
      </div>
      <PlanCards plans={plans} />
    </div>
  );
}
