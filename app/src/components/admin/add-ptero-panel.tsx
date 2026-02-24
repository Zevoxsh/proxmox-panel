"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/lib/api";

export function AddPteroPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", apiKey: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/ptero/panels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur lors de l'ajout");
      } else {
        toast.success("Panel Pterodactyl connecté !");
        setOpen(false);
        setForm({ name: "", url: "", apiKey: "" });
        router.refresh();
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un panel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connecter un panel Pterodactyl</DialogTitle>
          <DialogDescription>
            Entrez l'URL et la clé API Application de votre panel Pterodactyl.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nom du panel</Label>
            <Input
              placeholder="Panel Gaming 1"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>URL du panel</Label>
            <Input
              type="url"
              placeholder="https://panel.example.com"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              required
            />
            <p className="text-xs text-muted-foreground">Sans slash final</p>
          </div>
          <div className="space-y-2">
            <Label>Application API Key</Label>
            <Input
              type="password"
              placeholder="ptla_..."
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              required
            />
            <p className="text-xs text-muted-foreground">
              Dashboard Pterodactyl → Admin → Application API → Créer une clé
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Connexion en cours..." : "Connecter le panel"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
