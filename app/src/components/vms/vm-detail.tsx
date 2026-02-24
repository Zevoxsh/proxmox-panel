"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { VMStatusBadge } from "./vm-status-badge";
import { formatBytes, formatDate } from "@/lib/utils";
import {
  Play, Square, RefreshCw, Trash2, Server, Cpu,
  MemoryStick, HardDrive, Loader2,
  Terminal, Key, Info, ArrowDown, ArrowUp,
  PowerOff, RotateCcw, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/lib/api";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VmConsole } from "./vm-console";

interface VMDetailProps {
  vm: {
    id: string;
    vmid: number;
    name: string;
    type: string;
    status: string;
    ip: string | null;
    os: string | null;
    sshPublicKey: string | null;
    createdAt: Date;
    plan: { name: string; cpu: number; ramMb: number; diskGb: number };
    node: { name: string; host: string };
    user: { email: string; name: string | null };
  };
}

interface VMStatus {
  status: string;
  ip?: string | null;
  cpu?: number;
  mem?: number;
  maxmem?: number;
  disk?: number;
  maxdisk?: number;
  uptime?: number;
  netin?: number;
  netout?: number;
}

function formatUptime(seconds?: number): string {
  if (!seconds) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}j ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatNetBytes(bytes?: number): string {
  if (!bytes) return "0 B";
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function VMDetail({ vm }: VMDetailProps) {
  const router = useRouter();
  const [status, setStatus] = useState<VMStatus>({ status: vm.status });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [sshKey, setSshKey] = useState(vm.sshPublicKey ?? "");
  const [sshLoading, setSshLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/vms/${vm.id}/status`, {
        credentials: "include",
      });
      if (res.ok) setStatus(await res.json());
    } catch {}
  }, [vm.id]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  type PowerAction = "start" | "stop" | "shutdown" | "reboot" | "reset";

  const doAction = async (action: PowerAction) => {
    setActionLoading(action);
    try {
      const res = await fetch(`${getApiBaseUrl()}/vms/${vm.id}/${action}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      const successMsg: Record<string, string> = {
        start: "VM démarrée !",
        stop: "VM arrêtée (forcé) !",
        shutdown: "Extinction en cours…",
        reboot: "Redémarrage en cours…",
        reset: "Reset en cours…",
      };
      if (!res.ok) {
        toast.error(data.error ?? "Erreur");
      } else {
        toast.success(successMsg[action] ?? "Action effectuée");
        setTimeout(fetchStatus, 2000);
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
      const res = await fetch(`${getApiBaseUrl()}/vms/${vm.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur lors de la suppression");
        setActionLoading(null);
      } else {
        toast.success("VM supprimée !");
        router.push("/vms");
      }
    } catch {
      toast.error("Erreur réseau");
      setActionLoading(null);
    }
  };

  const saveSshKey = async () => {
    if (!sshKey.trim()) { toast.error("Entrez une clé SSH publique"); return; }
    setSshLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/vms/${vm.id}/ssh-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ publicKey: sshKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) toast.error(data.error ?? "Erreur");
      else toast.success("Clé SSH enregistrée");
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setSshLoading(false);
    }
  };

  const cpuPct  = status.cpu ? Math.round(status.cpu * 100) : 0;
  const memPct  = status.mem && status.maxmem ? Math.round((status.mem / status.maxmem) * 100) : 0;
  const diskPct = status.disk && status.maxdisk ? Math.round((status.disk / status.maxdisk) * 100) : 0;
  const isRunning    = status.status === "RUNNING";
  const isPending    = status.status === "PENDING";
  const isProvisioned = vm.vmid !== 0;

  return (
    <div className="space-y-5 animate-in">
      {/* Bannière PENDING */}
      {isPending && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 p-4 flex items-start gap-3">
          <span className="text-lg mt-0.5">⏳</span>
          <div>
            <p className="font-semibold text-amber-400 text-sm">VPS en attente de provisioning</p>
            <p className="text-xs text-amber-400/70 mt-1 leading-relaxed">
              Le déploiement sur Proxmox n&apos;a pas encore été effectué. Un administrateur peut
              relancer le provisioning manuellement.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/20">
            <Server className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display text-2xl font-bold">{vm.name}</h1>
              <VMStatusBadge status={status.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              <span className="font-mono text-xs bg-secondary/60 px-1.5 py-0.5 rounded">{vm.type}</span>
              <span className="mx-2 text-border">·</span>
              VMID <span className="font-mono">{vm.vmid}</span>
              <span className="mx-2 text-border">·</span>
              {vm.node.name}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={fetchStatus} disabled={!!actionLoading}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/8">
                <Trash2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Supprimer {vm.name} ?</DialogTitle>
                <DialogDescription>
                  Cette action est irréversible. La VM et toutes ses données seront supprimées de Proxmox.
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

      {/* Métriques temps réel */}
      {isRunning && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MetricCard
            icon={Cpu}
            label="CPU"
            value={`${cpuPct}%`}
            progress={cpuPct}
            sub={`${vm.plan.cpu} vCPU alloués`}
          />
          <MetricCard
            icon={MemoryStick}
            label="RAM"
            value={`${formatBytes(Math.round((status.mem ?? 0) / 1024 / 1024))} / ${formatBytes(vm.plan.ramMb)}`}
            progress={memPct}
            sub={`${memPct}% utilisé`}
          />
          <MetricCard
            icon={HardDrive}
            label="Disque"
            value={`${Math.round((status.disk ?? 0) / 1024 / 1024 / 1024)} GB / ${vm.plan.diskGb} GB`}
            progress={diskPct}
            sub={`${diskPct}% utilisé`}
          />
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList className="bg-secondary/50 p-1 h-auto">
            <TabsTrigger value="overview" className="gap-1.5 text-xs">
              <Info className="h-3.5 w-3.5" /> Aperçu
            </TabsTrigger>
            <TabsTrigger value="console" className="gap-1.5 text-xs">
              <Terminal className="h-3.5 w-3.5" /> Console
            </TabsTrigger>
            <TabsTrigger value="ssh" className="gap-1.5 text-xs">
              <Key className="h-3.5 w-3.5" /> SSH
            </TabsTrigger>
          </TabsList>

          {/* Power actions */}
          {isProvisioned && (
            <div className="flex items-center gap-1">
              {!isRunning && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                  onClick={() => doAction("start")}
                  disabled={!!actionLoading}
                  title="Démarrer"
                >
                  {actionLoading === "start"
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Play className="h-3.5 w-3.5 fill-current" />}
                  Démarrer
                </Button>
              )}
              {isRunning && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1.5 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                    onClick={() => doAction("shutdown")}
                    disabled={!!actionLoading}
                    title="Extinction gracieuse"
                  >
                    {actionLoading === "shutdown"
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <PowerOff className="h-3.5 w-3.5" />}
                    Shutdown
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary"
                    onClick={() => doAction("reboot")}
                    disabled={!!actionLoading}
                    title="Redémarrage gracieux"
                  >
                    {actionLoading === "reboot"
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <RefreshCw className="h-3.5 w-3.5" />}
                    Reboot
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary"
                    onClick={() => doAction("reset")}
                    disabled={!!actionLoading}
                    title="Reset (forcé)"
                  >
                    {actionLoading === "reset"
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <RotateCcw className="h-3.5 w-3.5" />}
                    Reset
                  </Button>
                  <div className="w-px h-5 bg-border/50 mx-0.5" />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => doAction("stop")}
                    disabled={!!actionLoading}
                    title="Arrêt forcé"
                  >
                    {actionLoading === "stop"
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Square className="h-3.5 w-3.5 fill-current" />}
                    Stop
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Infos générales */}
            <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border/50">
                <h3 className="text-sm font-semibold">Informations générales</h3>
              </div>
              <div className="px-5 py-4 space-y-3">
                <InfoRow label="Nom" value={vm.name} />
                <InfoRow label="Type" value={vm.type} />
                <InfoRow label="VMID" value={vm.vmid.toString()} mono />
                <InfoRow label="Node" value={vm.node.name} />
                <InfoRow
                  label="IP"
                  value={status.ip ?? vm.ip ?? "En attente d'attribution…"}
                  mono={!!(status.ip ?? vm.ip)}
                />
                <InfoRow
                  label="OS"
                  value={
                    vm.os
                      ?.split("/")
                      .pop()
                      ?.replace(".tar.gz", "")
                      .replace(".tar.xz", "") ?? "—"
                  }
                />
                <InfoRow label="Créée le" value={formatDate(vm.createdAt)} />
                {isRunning && <InfoRow label="Uptime" value={formatUptime(status.uptime)} />}
              </div>
            </div>

            {/* Plan & ressources */}
            <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border/50">
                <h3 className="text-sm font-semibold">Plan & Ressources</h3>
              </div>
              <div className="px-5 py-4 space-y-3">
                <InfoRow label="Plan" value={vm.plan.name} />
                <InfoRow label="vCPU" value={`${vm.plan.cpu} cœur(s)`} />
                <InfoRow label="RAM" value={formatBytes(vm.plan.ramMb)} />
                <InfoRow label="Disque" value={`${vm.plan.diskGb} GB SSD`} />
                {isRunning && (
                  <>
                    <div className="pt-1 border-t border-border/40" />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <ArrowDown className="h-3.5 w-3.5 text-emerald-400" /> Réseau in
                      </span>
                      <span className="font-mono text-xs">{formatNetBytes(status.netin)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <ArrowUp className="h-3.5 w-3.5 text-blue-400" /> Réseau out
                      </span>
                      <span className="font-mono text-xs">{formatNetBytes(status.netout)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="console" className="mt-4">
          <VmConsole vmId={vm.id} vmType={vm.type} isRunning={isRunning} />
        </TabsContent>

        <TabsContent value="ssh" className="mt-4">
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border/50">
              <h3 className="text-sm font-semibold">Clé SSH publique</h3>
            </div>
            <div className="px-5 py-4 space-y-4">
              <Input
                placeholder="ssh-ed25519 AAAA... votre@email"
                value={sshKey}
                onChange={(e) => setSshKey(e.target.value)}
                disabled={!isProvisioned || sshLoading}
                className="font-mono text-xs h-11 bg-secondary/50"
              />
              <p className="text-xs text-muted-foreground">
                Ajoutez votre clé publique pour vous connecter en SSH sans mot de passe.
                {status.ip || vm.ip ? (
                  <span className="block mt-1 font-mono text-foreground/60">
                    ssh root@{status.ip ?? vm.ip}
                  </span>
                ) : null}
              </p>
              <Button onClick={saveSshKey} disabled={!isProvisioned || sshLoading} size="sm">
                {sshLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer la clé
              </Button>
              {!isProvisioned && (
                <p className="text-xs text-muted-foreground">La VM n&apos;est pas encore provisionnée.</p>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({
  icon: Icon, label, value, progress, sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  progress: number;
  sub: string;
}) {
  const color =
    progress > 85
      ? "bg-red-500"
      : progress > 70
      ? "bg-amber-500"
      : "bg-primary";
  const textColor =
    progress > 85
      ? "text-red-400"
      : progress > 70
      ? "text-amber-400"
      : "text-foreground";

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="h-4 w-4" />
          <span>{label}</span>
        </div>
        <span className={`font-mono text-sm font-semibold ${textColor}`}>{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-2">{sub}</p>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs bg-secondary/50 px-2 py-0.5 rounded" : "font-medium text-right"}>
        {value}
      </span>
    </div>
  );
}
