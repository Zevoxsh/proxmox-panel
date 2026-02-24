"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Pencil, Trash2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/lib/api";

interface Props {
  nodeId: string;
  nodeName: string;
  currentHost: string;
  currentPort: number;
  currentUsername: string;
  currentRealm: string;
  vmCount: number;
}

export function NodeActions({
  nodeId,
  nodeName,
  currentHost,
  currentPort,
  currentUsername,
  currentRealm,
  vmCount,
}: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    host: currentHost,
    port: String(currentPort),
    username: currentUsername,
    password: "",
    realm: currentRealm,
  });

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        host: form.host,
        port: parseInt(form.port),
        username: form.username,
        realm: form.realm,
      };
      if (form.password) body.password = form.password;

      const res = await fetch(`${getApiBaseUrl()}/admin/nodes/${nodeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur lors de la mise à jour");
      } else {
        if (data.warning) toast.warning(data.warning);
        else toast.success("Nœud mis à jour et connecté !");
        setEditOpen(false);
        router.refresh();
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/nodes/${nodeId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur lors de la suppression");
      } else {
        toast.success("Nœud supprimé");
        setDeleteOpen(false);
        router.refresh();
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/nodes/${nodeId}/sync`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur lors de la synchronisation");
      } else {
        if (data.warning) toast.warning(data.warning);
        else toast.success("Templates synchronisés !");
        router.refresh();
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="h-3.5 w-3.5 mr-1.5" />
          Modifier
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={handleSync}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
          Sync
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="flex-1"
          onClick={() => setDeleteOpen(true)}
          disabled={vmCount > 0}
          title={vmCount > 0 ? `${vmCount} VM(s) sur ce nœud` : "Supprimer"}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          Supprimer
        </Button>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier — {nodeName}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <Label>Adresse IP / Hostname</Label>
                <Input
                  placeholder="192.168.1.100"
                  value={form.host}
                  onChange={(e) => setForm({ ...form, host: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Port</Label>
                <Input
                  placeholder="8006"
                  value={form.port}
                  onChange={(e) => setForm({ ...form, port: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Utilisateur</Label>
                <Input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Realm</Label>
                <Input
                  value={form.realm}
                  onChange={(e) => setForm({ ...form, realm: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                Nouveau mot de passe{" "}
                <span className="text-muted-foreground font-normal">(laisser vide pour ne pas changer)</span>
              </Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Test de connexion..." : "Enregistrer"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer {nodeName} ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Ce nœud sera retiré du panel. Les VMs associées resteront en place sur Proxmox
            mais ne seront plus gérables depuis le panel.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
