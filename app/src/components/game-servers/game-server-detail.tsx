"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GameStatusBadge } from "./game-status-badge";
import { GameIcon } from "./game-icon";
import { formatBytes, formatDate } from "@/lib/utils";
import {
  Play, Square, RotateCcw, Zap, Trash2,
  Copy, ExternalLink, Loader2, RefreshCw,
  Cpu, MemoryStick, HardDrive, Database, Archive,
} from "lucide-react";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/lib/api";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

interface GameServerDetailProps {
  server: {
    id: string;
    name: string;
    status: string;
    identifier: string;
    pteroUuid: string;
    pteroId: number;
    createdAt: Date;
    plan: {
      name: string;
      game: string;
      cpu: number;
      ramMb: number;
      diskMb: number;
      databases: number;
      backups: number;
    };
    panel: { name: string; url: string };
    user: { email: string; name: string | null };
  };
}

interface Resources {
  status: string;
  allocation?: { ip: string; port: number };
  limits?: { memory: number; disk: number; cpu: number };
}

export function GameServerDetail({ server }: GameServerDetailProps) {
  const router = useRouter();
  const [status, setStatus] = useState(server.status);
  const [resources, setResources] = useState<Resources>({ status: server.status });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const fetchResources = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/game-servers/${server.id}/resources`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setResources(data);
        setStatus(data.status);
      }
    } catch {}
  }, [server.id]);

  useEffect(() => {
    fetchResources();
    const interval = setInterval(fetchResources, 15000);
    return () => clearInterval(interval);
  }, [fetchResources]);

  const doPower = async (action: "start" | "stop" | "restart") => {
    setActionLoading(action);
    try {
      const res = await fetch(`${getApiBaseUrl()}/game-servers/${server.id}/power`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur");
      } else {
        toast.success(
          action === "start" ? "Serveur démarré !" :
          action === "stop" ? "Serveur arrêté !" :
          "Serveur redémarré !"
        );
        setTimeout(fetchResources, 3000);
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setActionLoading(null);
    }
  };

  const doDelete = async () => {
    setActionLoading("delete");
    try {
      const res = await fetch(`${getApiBaseUrl()}/game-servers/${server.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error ?? "Erreur lors de la suppression");
        setActionLoading(null);
      } else {
        toast.success("Serveur supprimé !");
        router.push("/game-servers");
      }
    } catch {
      toast.error("Erreur réseau");
      setActionLoading(null);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copié !`));
  };

  const isRunning = status === "RUNNING";
  const isStopped = status === "STOPPED";
  const connectionStr = resources.allocation
    ? `${resources.allocation.ip}:${resources.allocation.port}`
    : null;

  const panelUrl = `${server.panel.url}/server/${server.identifier}`;

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <GameIcon game={server.plan.game} size="lg" />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{server.name}</h1>
              <GameStatusBadge status={status} />
            </div>
            <p className="text-muted-foreground mt-1 capitalize">
              {server.plan.game} · {server.panel.name} ·{" "}
              <span className="font-mono text-xs">{server.identifier}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Power actions */}
          {isStopped && (
            <Button variant="outline" size="sm" onClick={() => doPower("start")} disabled={!!actionLoading}>
              {actionLoading === "start" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 mr-1.5" />}
              Démarrer
            </Button>
          )}
          {isRunning && (
            <>
              <Button variant="outline" size="sm" onClick={() => doPower("restart")} disabled={!!actionLoading}>
                {actionLoading === "restart" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-1.5" />}
                Redémarrer
              </Button>
              <Button variant="outline" size="sm" onClick={() => doPower("stop")} disabled={!!actionLoading}>
                {actionLoading === "stop" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4 mr-1.5" />}
                Arrêter
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={fetchResources} disabled={!!actionLoading}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            asChild
          >
            <a href={panelUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1.5" />
              Panel Ptero
            </a>
          </Button>
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Supprimer {server.name} ?</DialogTitle>
                <DialogDescription>
                  Cette action est irréversible. Le serveur et toutes ses données seront supprimés du panel Pterodactyl.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteOpen(false)}>Annuler</Button>
                <Button variant="destructive" onClick={doDelete} disabled={actionLoading === "delete"}>
                  {actionLoading === "delete" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Supprimer définitivement
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Connexion rapide */}
      {connectionStr && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Adresse de connexion</p>
                <p className="font-mono font-bold text-lg">{connectionStr}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(connectionStr, "Adresse")}
              >
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Copier
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Informations générales</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Nom" value={server.name} />
            <InfoRow label="Jeu" value={server.plan.game} capitalize />
            <InfoRow label="Identifiant" value={server.identifier} mono />
            <InfoRow label="UUID Pterodactyl" value={server.pteroUuid.slice(0, 20) + "..."} mono />
            <InfoRow label="Panel" value={server.panel.name} />
            <InfoRow label="Créé le" value={formatDate(server.createdAt)} />
            {resources.allocation && (
              <InfoRow label="Port" value={resources.allocation.port.toString()} mono />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Plan & Ressources</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Plan" value={server.plan.name} />
            <div className="space-y-3 pt-1">
              <ResourceRow icon={Cpu} label="CPU" value={`${server.plan.cpu}%`} />
              <ResourceRow icon={MemoryStick} label="RAM" value={formatBytes(server.plan.ramMb)} />
              <ResourceRow icon={HardDrive} label="Disque" value={`${(server.plan.diskMb / 1024).toFixed(0)} GB`} />
              <ResourceRow icon={Database} label="Bases de données" value={server.plan.databases.toString()} />
              <ResourceRow icon={Archive} label="Sauvegardes" value={server.plan.backups.toString()} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SFTP info */}
      <Card>
        <CardHeader><CardTitle className="text-base">Accès SFTP</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Serveur SFTP</p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-sm">{new URL(server.panel.url).hostname}:2022</p>
                <Button variant="ghost" size="icon" className="h-6 w-6"
                  onClick={() => copyToClipboard(`${new URL(server.panel.url).hostname}:2022`, "Hôte SFTP")}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Utilisateur</p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-sm">{server.user.email}.{server.identifier}</p>
                <Button variant="ghost" size="icon" className="h-6 w-6"
                  onClick={() => copyToClipboard(`${server.user.email}.${server.identifier}`, "Utilisateur SFTP")}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Mot de passe SFTP : le même que votre compte Pterodactyl. Utilisez FileZilla, WinSCP ou tout client SFTP.
          </p>
        </CardContent>
      </Card>
    </>
  );
}

function InfoRow({ label, value, mono, capitalize }: {
  label: string; value: string; mono?: boolean; capitalize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${mono ? "font-mono text-xs" : "font-medium"} ${capitalize ? "capitalize" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function ResourceRow({ icon: Icon, label, value }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <span className="font-medium">{value}</span>
    </div>
  );
}
