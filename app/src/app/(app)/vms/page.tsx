import Link from "next/link";
import { serverFetch } from "@/lib/server-api";

export default async function VmsPage() {
  const res = await serverFetch("/vms");
  const vms = res.ok ? await res.json() : [];
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">VMs</h1>
      {vms.length === 0 ? (
        <div className="card p-4">Aucune VM</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {vms.map((vm: any) => (
            <Link key={vm.id} href={`/vms/${vm.id}`} className="card p-4 hover:bg-white/5">
              <div className="font-semibold">{vm.name}</div>
              <div className="text-sm text-muted">{vm.status} · {vm.type} · VMID {vm.vmid}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
