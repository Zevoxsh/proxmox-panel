"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { GameStatusBadge } from "./game-status-badge";
import { GameIcon } from "./game-icon";
import { formatBytes } from "@/lib/utils";

interface GameServer {
  id: string;
  name: string;
  status: string;
  identifier: string;
  createdAt: Date;
  plan: { name: string; game: string; ramMb: number; cpu: number };
  panel: { name: string; url: string };
}

export function GameServerTable({ servers }: { servers: GameServer[] }) {
  return (
    <div className="w-full">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-6 py-3 text-muted-foreground font-medium">Serveur</th>
            <th className="text-left px-6 py-3 text-muted-foreground font-medium">Statut</th>
            <th className="text-left px-6 py-3 text-muted-foreground font-medium hidden md:table-cell">Plan</th>
            <th className="text-left px-6 py-3 text-muted-foreground font-medium hidden lg:table-cell">Ressources</th>
            <th className="text-left px-6 py-3 text-muted-foreground font-medium hidden xl:table-cell">Panel</th>
            <th className="px-6 py-3" />
          </tr>
        </thead>
        <tbody>
          {servers.map((s) => (
            <tr
              key={s.id}
              className="border-b border-border hover:bg-accent/50 transition-colors group"
            >
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <GameIcon game={s.plan.game} size="sm" />
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{s.identifier}</p>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                <GameStatusBadge status={s.status} />
              </td>
              <td className="px-6 py-4 hidden md:table-cell">
                <p className="text-sm">{s.plan.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{s.plan.game}</p>
              </td>
              <td className="px-6 py-4 hidden lg:table-cell text-xs text-muted-foreground">
                <p>{s.plan.cpu}% CPU</p>
                <p>{formatBytes(s.plan.ramMb)} RAM</p>
              </td>
              <td className="px-6 py-4 hidden xl:table-cell text-xs text-muted-foreground">
                {s.panel.name}
              </td>
              <td className="px-6 py-4 text-right">
                <Link
                  href={`/game-servers/${s.id}`}
                  className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
