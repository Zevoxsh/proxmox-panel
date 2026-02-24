import { auth } from "@/lib/auth";
import { serverFetch } from "@/lib/server-api";
import { notFound } from "next/navigation";
import { VMDetail } from "@/components/vms/vm-detail";

export default async function VMDetailPage({ params }: { params: Promise<{ vmid: string }> }) {
  const { vmid } = await params;
  await auth();

  const res = await serverFetch(`/vms/${vmid}`);
  const vm = res.ok ? await res.json() : null;

  if (!vm) notFound();

  return (
    <div className="space-y-6 animate-in">
      <VMDetail vm={vm} />
    </div>
  );
}
