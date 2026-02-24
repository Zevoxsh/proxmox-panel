import { serverFetch } from "@/lib/server-api";
import { notFound } from "next/navigation";

export default async function VmDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await serverFetch(`/vms/${id}`);
  if (!res.ok) return notFound();
  const vm = await res.json();
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">{vm.name}</h1>
      <div className="card p-4 space-y-1">
        <div>Status: {vm.status}</div>
        <div>Type: {vm.type}</div>
        <div>VMID: {vm.vmid}</div>
        <div>Plan: {vm.plan?.name}</div>
        <div>Node: {vm.node?.name}</div>
      </div>
    </div>
  );
}
