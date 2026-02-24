"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/lib/api";

interface Panel {
  id: string;
  name: string;
  url: string;
}

const KNOWN_GAMES = [
  "minecraft", "csgo", "cs2", "valheim", "terraria",
  "rust", "ark", "factorio", "satisfactory", "7dtd",
];

export function AddGamePlanForm({ panels }: { panels: Panel[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", game: "minecraft",
    cpu: "100", ramMb: "2048", diskMb: "10240",
    databases: "1", backups: "2", allocations: "1",
    priceMonthly: "9.99",
    nestId: "", eggId: "",
    dockerImage: "", startup: "",
    panelId: panels[0]?.id ?? "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/game-plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...form,
          cpu: parseInt(form.cpu),
          ramMb: parseInt(form.ramMb),
          diskMb: parseInt(form.diskMb),
          databases: parseInt(form.databases),
          backups: parseInt(form.backups),
          allocations: parseInt(form.allocations),
          priceMonthly: parseFloat(form.priceMonthly),
          nestId: parseInt(form.nestId),
          eggId: parseInt(form.eggId),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur");
      } else {
        toast.success("Offre gaming créée !");
        setOpen(false);
        router.refresh();
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  const f = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle offre
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer une offre gaming</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Infos générales */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Nom de l'offre</Label>
              <Input placeholder="Minecraft Starter" value={form.name} onChange={(e) => f("name", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Jeu</Label>
              <Select value={form.game} onValueChange={(v) => f("game", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KNOWN_GAMES.map((g) => (
                    <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Input placeholder="Parfait pour débuter..." value={form.description} onChange={(e) => f("description", e.target.value)} />
          </div>

          {/* Ressources */}
          <p className="text-sm font-medium text-muted-foreground pt-2">Ressources</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>CPU (%)</Label>
              <Input type="number" placeholder="100" value={form.cpu} onChange={(e) => f("cpu", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>RAM (Mo)</Label>
              <Input type="number" placeholder="2048" value={form.ramMb} onChange={(e) => f("ramMb", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Disque (Mo)</Label>
              <Input type="number" placeholder="10240" value={form.diskMb} onChange={(e) => f("diskMb", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Bases de données</Label>
              <Input type="number" value={form.databases} onChange={(e) => f("databases", e.target.value)} min={0} />
            </div>
            <div className="space-y-2">
              <Label>Sauvegardes</Label>
              <Input type="number" value={form.backups} onChange={(e) => f("backups", e.target.value)} min={0} />
            </div>
            <div className="space-y-2">
              <Label>Prix/mois (€)</Label>
              <Input type="number" step="0.01" value={form.priceMonthly} onChange={(e) => f("priceMonthly", e.target.value)} required />
            </div>
          </div>

          {/* Pterodactyl config */}
          <p className="text-sm font-medium text-muted-foreground pt-2">Configuration Pterodactyl</p>
          <div className="space-y-2">
            <Label>Panel</Label>
            <Select value={form.panelId} onValueChange={(v) => f("panelId", v)}>
              <SelectTrigger><SelectValue placeholder="Choisir un panel" /></SelectTrigger>
              <SelectContent>
                {panels.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Nest ID</Label>
              <Input type="number" placeholder="1" value={form.nestId} onChange={(e) => f("nestId", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Egg ID</Label>
              <Input type="number" placeholder="15" value={form.eggId} onChange={(e) => f("eggId", e.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Image Docker</Label>
            <Input placeholder="ghcr.io/pterodactyl/yolks:java_17" value={form.dockerImage} onChange={(e) => f("dockerImage", e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Commande de démarrage (startup)</Label>
            <Input placeholder="java -Xms128M -XX:MaxRAMPercentage=95.0 -jar server.jar" value={form.startup} onChange={(e) => f("startup", e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={loading || panels.length === 0}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Créer l'offre
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
