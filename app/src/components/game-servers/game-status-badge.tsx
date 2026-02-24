import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  RUNNING: "En ligne",
  STOPPED: "Hors ligne",
  INSTALLING: "Installation",
  PENDING: "En attente",
  SUSPENDED: "Suspendu",
  ERROR: "Erreur",
  DELETING: "Suppression",
};

const STATUS_STYLES: Record<string, string> = {
  RUNNING: "bg-green-400/10 text-green-400 ring-green-400/20",
  STOPPED: "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20",
  INSTALLING: "bg-blue-400/10 text-blue-400 ring-blue-400/20",
  PENDING: "bg-yellow-400/10 text-yellow-400 ring-yellow-400/20",
  SUSPENDED: "bg-orange-400/10 text-orange-400 ring-orange-400/20",
  ERROR: "bg-red-600/10 text-red-500 ring-red-600/20",
  DELETING: "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20",
};

const PULSE: Record<string, boolean> = {
  RUNNING: true,
  INSTALLING: true,
  PENDING: true,
};

export function GameStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        STATUS_STYLES[status] ?? STATUS_STYLES.STOPPED
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full bg-current",
          PULSE[status] && "animate-pulse"
        )}
      />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
