"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Cpu, MemoryStick, HardDrive, Zap } from "lucide-react";
import { toast } from "sonner";
import { formatBytes, formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { getApiBaseUrl } from "@/lib/api";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  cpu: number;
  ramMb: number;
  diskGb: number;
  priceMonthly: number;
  type: string;
}

interface Node {
  id: string;
  name: string;
}

const OS_TEMPLATES_LXC = [
  { value: "local:vztmpl/debian-12-standard_12.0-1_amd64.tar.zst", label: "Debian 12" },
  { value: "local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst", label: "Ubuntu 22.04" },
  { value: "local:vztmpl/alpine-3.19-default_20231219_amd64.tar.xz", label: "Alpine 3.19" },
  { value: "local:vztmpl/centos-9-stream-default_20221129_amd64.tar.xz", label: "CentOS Stream 9" },
];

export function CreateVMForm({ plans, nodes }: { plans: Plan[]; nodes: Node[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "LXC",
    planId: "",
    nodeId: nodes[0]?.id ?? "",
    os: OS_TEMPLATES_LXC[0].value,
  });

  const lxcPlans = plans.filter((p) => p.type === "LXC");
  const kvmPlans = plans.filter((p) => p.type === "KVM");
  const currentPlans = form.type === "LXC" ? lxcPlans : kvmPlans;

  const handleTypeChange = (type: string) => {
    setForm({ ...form, type, planId: "" });
    setSelectedPlan(null);
  };

  const handlePlanSelect = (plan: Plan) => {
    setSelectedPlan(plan);
    setForm({ ...form, planId: plan.id });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.planId) { toast.error("Choisissez un plan"); return; }
    if (!form.nodeId) { toast.error("Aucun nœud disponible"); return; }
    if (!/^[a-zA-Z0-9-]+$/.test(form.name)) {
      toast.error("Le nom ne peut contenir que des lettres, chiffres et tirets");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/vms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur lors de la création");
      } else {
        toast.success("VM créée avec succès !");
        router.push(`/vms/${data.id}`);
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Type VM */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Type de virtualisation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {["LXC", "KVM"].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleTypeChange(type)}
                className={cn(
                  "flex flex-col items-start p-4 rounded-lg border-2 transition-all text-left",
                  form.type === type
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-border/80 hover:bg-accent"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4" />
                  <span className="font-semibold">{type}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {type === "LXC"
                    ? "Conteneur léger, démarrage rapide, moins de ressources"
                    : "Virtualisation complète, OS dédié, isolation totale"}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Choisir un plan</CardTitle>
          <CardDescription>{currentPlans.length} plans disponibles pour {form.type}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {currentPlans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => handlePlanSelect(plan)}
                className={cn(
                  "flex flex-col p-4 rounded-lg border-2 transition-all text-left",
                  selectedPlan?.id === plan.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-border/80 hover:bg-accent"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">{plan.name}</span>
                  <span className="text-sm font-bold text-primary">{formatCurrency(plan.priceMonthly)}/mois</span>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Cpu className="h-3 w-3" />
                    <span>{plan.cpu} vCPU</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MemoryStick className="h-3 w-3" />
                    <span>{formatBytes(plan.ramMb)} RAM</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <HardDrive className="h-3 w-3" />
                    <span>{plan.diskGb} GB SSD</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom de la VM</Label>
            <Input
              id="name"
              placeholder="mon-serveur-web"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              pattern="[a-zA-Z0-9-]+"
              required
            />
            <p className="text-xs text-muted-foreground">Lettres, chiffres et tirets uniquement</p>
          </div>

          {form.type === "LXC" && (
            <div className="space-y-2">
              <Label>Template OS</Label>
              <Select value={form.os} onValueChange={(v) => setForm({ ...form, os: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un OS" />
                </SelectTrigger>
                <SelectContent>
                  {OS_TEMPLATES_LXC.map((os) => (
                    <SelectItem key={os.value} value={os.value}>{os.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {nodes.length > 1 && (
            <div className="space-y-2">
              <Label>Nœud Proxmox</Label>
              <Select value={form.nodeId} onValueChange={(v) => setForm({ ...form, nodeId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un nœud" />
                </SelectTrigger>
                <SelectContent>
                  {nodes.map((node) => (
                    <SelectItem key={node.id} value={node.id}>{node.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary + submit */}
      {selectedPlan && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-semibold">{selectedPlan.name}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedPlan.cpu} vCPU · {formatBytes(selectedPlan.ramMb)} · {selectedPlan.diskGb} GB
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{formatCurrency(selectedPlan.priceMonthly)}</p>
                <p className="text-xs text-muted-foreground">par mois</p>
              </div>
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading || !form.name}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Déploiement en cours..." : "Déployer la VM"}
            </Button>
          </CardContent>
        </Card>
      )}

      {!selectedPlan && (
        <Button type="submit" className="w-full" size="lg" disabled>
          Choisissez un plan pour continuer
        </Button>
      )}
    </form>
  );
}
