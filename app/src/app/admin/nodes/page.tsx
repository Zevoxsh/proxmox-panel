import { serverFetch } from "@/lib/server-api";
import { AddNodeForm } from "@/components/admin/add-node-form";
import { NodeActions } from "@/components/admin/node-actions";
import { Network, Server, CheckCircle, XCircle, Plus } from "lucide-react";

type AdminNode = {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  realm: string;
  isActive: boolean;
  lxcTemplateDefault?: string | null;
  kvmTemplateVmid?: number | null;
  sslVerify: boolean;
  _count: { vms: number };
};

export default async function AdminNodesPage() {
  const res = await serverFetch("/admin/nodes");
  const nodes = (res.ok ? await res.json() : []) as AdminNode[];

  return (
    <div className="space-y-5 animate-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-1">Infrastructure</p>
          <h1 className="font-display text-2xl font-bold">Nœuds Proxmox</h1>
          <p className="text-sm text-muted-foreground mt-1">{nodes.length} nœud(s) configuré(s)</p>
        </div>
        <AddNodeForm />
      </div>

      {nodes.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center border border-primary/15">
            <Network className="h-7 w-7 text-primary/60" />
          </div>
          <div className="text-center">
            <p className="font-medium mb-1">Aucun nœud configuré</p>
            <p className="text-sm text-muted-foreground">
              Ajoutez votre serveur Proxmox pour commencer
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {nodes.map((node) => (
            <div key={node.id} className="rounded-xl border border-border/60 bg-card overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Server className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{node.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {node.host}:{node.port}
                    </p>
                  </div>
                </div>
                {node.isActive ? (
                  <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                )}
              </div>

              {/* Details */}
              <div className="px-5 py-4 space-y-2.5 text-sm">
                <NodeRow label="Utilisateur" value={`${node.username}@${node.realm}`} mono />
                <NodeRow label="VMs hébergées" value={node._count.vms.toString()} />
                <NodeRow
                  label="Template LXC"
                  value={node.lxcTemplateDefault?.split("/").pop() ?? "—"}
                  mono
                />
                <NodeRow
                  label="Template KVM"
                  value={node.kvmTemplateVmid?.toString() ?? "—"}
                  mono
                />
                <NodeRow label="SSL" value={node.sslVerify ? "Vérifié" : "Désactivé"} />
                <NodeRow
                  label="Statut"
                  value={node.isActive ? "Connecté" : "Injoignable"}
                  valueClass={node.isActive ? "text-emerald-400" : "text-red-400"}
                />
              </div>

              {/* Footer actions */}
              <div className="px-5 pb-4">
                <NodeActions
                  nodeId={node.id}
                  nodeName={node.name}
                  currentHost={node.host}
                  currentPort={node.port}
                  currentUsername={node.username}
                  currentRealm={node.realm}
                  vmCount={node._count.vms}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NodeRow({
  label,
  value,
  mono,
  valueClass,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span
        className={`text-xs truncate max-w-[160px] text-right ${
          mono ? "font-mono" : "font-medium"
        } ${valueClass ?? ""}`}
      >
        {value}
      </span>
    </div>
  );
}
