import { auth } from "@/lib/auth";
import { serverFetch } from "@/lib/server-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Gamepad2 } from "lucide-react";
import Link from "next/link";
import { GameServerTable } from "@/components/game-servers/game-server-table";

export default async function GameServersPage() {
  await auth();
  const res = await serverFetch("/game-servers");
  const servers = res.ok ? await res.json() : [];

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Serveurs Gaming</h1>
          <p className="text-muted-foreground mt-1">{servers.length} serveur(s) de jeu</p>
        </div>
        <Button asChild>
          <Link href="/game-servers/new">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau serveur
          </Link>
        </Button>
      </div>

      {servers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Gamepad2 className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun serveur gaming</h3>
            <p className="text-muted-foreground text-center mb-6">
              Lancez votre serveur Minecraft, CS2, Valheim... en quelques secondes.
            </p>
            <Button asChild>
              <Link href="/game-servers/new">
                <Plus className="mr-2 h-4 w-4" />
                Créer mon premier serveur
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <GameServerTable servers={servers} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
