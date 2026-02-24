import { auth } from "@/lib/auth";
import { serverFetch } from "@/lib/server-api";
import { notFound } from "next/navigation";
import { GameServerDetail } from "@/components/game-servers/game-server-detail";

export default async function GameServerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await auth();
  const res = await serverFetch(`/game-servers/${id}`);
  const server = res.ok ? await res.json() : null;

  if (!server) notFound();

  return (
    <div className="space-y-6 animate-in">
      <GameServerDetail server={server} />
    </div>
  );
}
