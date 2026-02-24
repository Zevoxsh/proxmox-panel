"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Cpu, MemoryStick, HardDrive, Database, Archive } from "lucide-react";
import { toast } from "sonner";
import { formatBytes, formatCurrency } from "@/lib/utils";
import { GameIcon } from "./game-icon";
import { cn } from "@/lib/utils";
import { getApiBaseUrl } from "@/lib/api";

interface GamePlan {
  id: string;
  name: string;
  description: string | null;
  game: string;
  cpu: number;
  ramMb: number;
  diskMb: number;
  databases: number;
  backups: number;
  priceMonthly: number;
  panel: { name: string };
}

// Regrouper par jeu
function groupByGame(plans: GamePlan[]): Record<string, GamePlan[]> {
  return plans.reduce(
    (acc, p) => {
      const g = p.game.toLowerCase();
      if (!acc[g]) acc[g] = [];
      acc[g].push(p);
      return acc;
    },
    {} as Record<string, GamePlan[]>
  );
}

const GAME_LABELS: Record<string, string> = {
  minecraft: "Minecraft",
  csgo: "CS:GO / CS2",
  cs2: "CS2",
  valheim: "Valheim",
  terraria: "Terraria",
  rust: "Rust",
  ark: "ARK",
  factorio: "Factorio",
  satisfactory: "Satisfactory",
  "7dtd": "7 Days to Die",
};

export function CreateGameServerForm({ plans }: { plans: GamePlan[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<GamePlan | null>(null);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [name, setName] = useState("");

  const grouped = groupByGame(plans);
  const games = Object.keys(grouped);

  const handleGameSelect = (game: string) => {
    setSelectedGame(game);
    setSelectedPlan(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) { toast.error("Choisissez un plan"); return; }
    if (!name.trim()) { toast.error("Donnez un nom à votre serveur"); return; }

    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/game-servers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ planId: selectedPlan.id, name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur lors de la création");
      } else {
        toast.success("Serveur créé ! Installation en cours...");
        router.push(`/game-servers/${data.id}`);
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Step 1 — Choisir le jeu */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Choisir le jeu</CardTitle>
          <CardDescription>{games.length} jeux disponibles</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {games.map((game) => (
              <button
                key={game}
                type="button"
                onClick={() => handleGameSelect(game)}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                  selectedGame === game
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-border/80 hover:bg-accent"
                )}
              >
                <GameIcon game={game} size="md" />
                <span className="text-xs font-medium text-center leading-tight">
                  {GAME_LABELS[game] ?? game}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 2 — Choisir le plan */}
      {selectedGame && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              2. Choisir la configuration —{" "}
              <span className="capitalize">{GAME_LABELS[selectedGame] ?? selectedGame}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {grouped[selectedGame].map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan)}
                  className={cn(
                    "flex flex-col text-left p-4 rounded-lg border-2 transition-all",
                    selectedPlan?.id === plan.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-border/80 hover:bg-accent"
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-sm">{plan.name}</p>
                      {plan.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="font-bold text-primary">{formatCurrency(plan.priceMonthly)}</p>
                      <p className="text-xs text-muted-foreground">/mois</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Cpu className="h-3 w-3" /> {plan.cpu}% CPU
                    </span>
                    <span className="flex items-center gap-1">
                      <MemoryStick className="h-3 w-3" /> {formatBytes(plan.ramMb)}
                    </span>
                    <span className="flex items-center gap-1">
                      <HardDrive className="h-3 w-3" /> {(plan.diskMb / 1024).toFixed(0)} GB
                    </span>
                    <span className="flex items-center gap-1">
                      <Database className="h-3 w-3" /> {plan.databases} DB
                    </span>
                    <span className="flex items-center gap-1 col-span-2">
                      <Archive className="h-3 w-3" /> {plan.backups} sauvegardes
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — Nom du serveur */}
      {selectedPlan && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Nommer votre serveur</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-w-sm">
              <Label htmlFor="serverName">Nom du serveur</Label>
              <Input
                id="serverName"
                placeholder="Mon serveur Minecraft"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={32}
                required
              />
              <p className="text-xs text-muted-foreground">
                Ce nom sera affiché dans le panel Pterodactyl
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Récapitulatif + bouton */}
      {selectedPlan && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 mb-4">
              <GameIcon game={selectedGame!} size="lg" />
              <div className="flex-1">
                <p className="font-bold text-lg">{selectedPlan.name}</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {GAME_LABELS[selectedGame!] ?? selectedGame} ·{" "}
                  {selectedPlan.cpu}% CPU · {formatBytes(selectedPlan.ramMb)} RAM ·{" "}
                  {(selectedPlan.diskMb / 1024).toFixed(0)} GB
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{formatCurrency(selectedPlan.priceMonthly)}</p>
                <p className="text-xs text-muted-foreground">par mois</p>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading || !name.trim()}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Déploiement en cours..." : "Déployer le serveur"}
            </Button>
          </CardContent>
        </Card>
      )}

      {!selectedGame && (
        <Button type="submit" className="w-full" disabled>
          Choisissez un jeu pour commencer
        </Button>
      )}
    </form>
  );
}
