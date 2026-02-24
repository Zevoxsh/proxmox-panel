import { serverFetch } from "@/lib/server-api";
import { CreateGameServerForm } from "@/components/game-servers/create-game-server-form";

export default async function NewGameServerPage() {
  const plansRes = await serverFetch("/game-servers/plans");
  const plans = plansRes.ok ? await plansRes.json() : [];

  if (plans.length === 0) {
    return (
      <div className="space-y-4 animate-in max-w-2xl">
        <h1 className="text-3xl font-bold">Nouveau serveur gaming</h1>
        <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-6 text-center">
          <p className="text-yellow-400 font-medium">Aucun plan gaming disponible</p>
          <p className="text-sm text-muted-foreground mt-1">
            Un administrateur doit créer des offres de serveurs gaming.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Nouveau serveur gaming</h1>
        <p className="text-muted-foreground mt-1">
          Déployez votre serveur en quelques secondes via Pterodactyl
        </p>
      </div>
      <CreateGameServerForm plans={plans} />
    </div>
  );
}
