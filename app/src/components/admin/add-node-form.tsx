"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/lib/api";

export function AddNodeForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", host: "", port: "8006",
    username: "root", password: "", realm: "pam",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...form, port: parseInt(form.port) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur lors de l'ajout");
      } else {
        if (data.warning) {
          toast.warning(data.warning);
        } else {
          toast.success("Nœud ajouté et connecté !");
        }
        setOpen(false);
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
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Ajouter un nœud
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un nœud Proxmox</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nom du nœud</Label>
            <Input placeholder="pve-node-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label>Adresse IP / Hostname</Label>
              <Input placeholder="192.168.1.100" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Port</Label>
              <Input placeholder="8006" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Utilisateur</Label>
              <Input placeholder="root" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Realm</Label>
              <Input placeholder="pam" value={form.realm} onChange={(e) => setForm({ ...form, realm: e.target.value })} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Mot de passe</Label>
            <Input type="password" placeholder="••••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Connexion en cours..." : "Ajouter le nœud"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}
