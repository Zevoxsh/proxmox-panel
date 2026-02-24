const statusConfig: Record<
  string,
  { label: string; dotClass: string; textClass: string; pulse: boolean }
> = {
  RUNNING:  { label: "Actif",       dotClass: "bg-emerald-400", textClass: "text-emerald-400", pulse: true },
  STOPPED:  { label: "Arrêté",      dotClass: "bg-zinc-500",    textClass: "text-zinc-400",    pulse: false },
  PENDING:  { label: "En cours",    dotClass: "bg-amber-400",   textClass: "text-amber-400",   pulse: true },
  SUSPENDED:{ label: "Suspendu",    dotClass: "bg-orange-400",  textClass: "text-orange-400",  pulse: false },
  ERROR:    { label: "Erreur",      dotClass: "bg-red-500",     textClass: "text-red-400",     pulse: false },
  DELETING: { label: "Suppression", dotClass: "bg-red-400",     textClass: "text-red-400",     pulse: true },
};

export function VMStatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? {
    label: status,
    dotClass: "bg-zinc-500",
    textClass: "text-zinc-400",
    pulse: false,
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        {cfg.pulse && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-50 ${cfg.dotClass}`} />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${cfg.dotClass}`} />
      </span>
      <span className={`text-xs font-medium ${cfg.textClass}`}>{cfg.label}</span>
    </span>
  );
}
