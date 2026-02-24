import { auth } from "@/lib/auth";
import { serverFetch } from "@/lib/server-api";
import { Button } from "@/components/ui/button";
import { Plus, Server } from "lucide-react";
import Link from "next/link";
import { VMTable } from "@/components/vms/vm-table";

type VMRow = {
  id: string;
  name: string;
  status: string;
  vmid: number;
  type: string;
  ip: string | null;
  os?: string | null;
  plan: { name: string; cpu: number; ramMb: number; diskGb: number; priceMonthly: number; type: string };
  node: { name: string };
};

export default async function VMsPage() {
  await auth();
  const res = await serverFetch("/vms");
  const vms = (res.ok ? await res.json() : []) as VMRow[];

  const running = vms.filter((v) => v.status === "RUNNING").length;

  return (
    <div className="space-y-5 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Mes VMs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {vms.length} machine(s) · {running} active(s)
          </p>
        </div>
        <Button asChild size="sm" className="shadow-md shadow-primary/20">
          <Link href="/vms/new">
            <Plus className="mr-1.5 h-4 w-4" />
            Nouvelle VM
          </Link>
        </Button>
      </div>

      {vms.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/8 flex items-center justify-center border border-primary/15">
            <Server className="h-8 w-8 text-primary/60" />
          </div>
          <div className="text-center">
            <h3 className="font-display font-semibold mb-1">Aucune VM</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Créez votre première machine virtuelle en choisissant un plan adapté à vos besoins.
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/vms/new">
              <Plus className="mr-1.5 h-4 w-4" />
              Créer ma première VM
            </Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border/60 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Toutes les machines</h2>
            <span className="text-xs text-muted-foreground font-mono">{vms.length}</span>
          </div>
          <VMTable vms={vms} />
        </div>
      )}
    </div>
  );
}
