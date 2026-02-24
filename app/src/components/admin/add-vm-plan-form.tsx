"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/lib/api";

export function AddVmPlanForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "LXC",
    cpu: "2",
    ramMb: "2048",
    diskGb: "40",
    bandwidthGb: "",
    priceMonthly: "9.99",
  });

  const f = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/vm-plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          type: form.type,
          cpu: parseInt(form.cpu, 10),
          ramMb: parseInt(form.ramMb, 10),
          diskGb: parseInt(form.diskGb, 10),
          bandwidthGb: form.bandwidthGb ? parseInt(form.bandwidthGb, 10) : undefined,
          priceMonthly: parseFloat(form.priceMonthly),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur");
      } else {
        toast.success("Plan VPS créé !");
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau plan VPS
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Créer un plan VPS</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Nom du plan</Label>
              <Input value={form.name} onChange={(e) => f("name", e.target.value)} placeholder="VPS Starter" required />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => f("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LXC">LXC</SelectItem>
                  <SelectItem value="KVM">KVM</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={form.description} onChange={(e) => f("description", e.target.value)} placeholder="Plan idéal pour débuter" />
          </div>

          <p className="text-sm font-medium text-muted-foreground pt-2">Ressources</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>vCPU</Label>
              <Input type="number" min={1} value={form.cpu} onChange={(e) => f("cpu", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>RAM (Mo)</Label>
              <Input type="number" min={256} value={form.ramMb} onChange={(e) => f("ramMb", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Disque (Go)</Label>
              <Input type="number" min={5} value={form.diskGb} onChange={(e) => f("diskGb", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Bande passante (Go)</Label>
              <Input type="number" min={0} value={form.bandwidthGb} onChange={(e) => f("bandwidthGb", e.target.value)} placeholder="Illimitée" />
            </div>
            <div className="space-y-2">
              <Label>Prix/mois (€)</Label>
              <Input type="number" step="0.01" value={form.priceMonthly} onChange={(e) => f("priceMonthly", e.target.value)} required />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Créer le plan
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
