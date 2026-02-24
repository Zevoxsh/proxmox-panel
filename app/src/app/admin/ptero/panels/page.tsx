import { serverFetch } from "@/lib/server-api";
import { Card, CardContent } from "@/components/ui/card";
import { AddPteroPanel } from "@/components/admin/add-ptero-panel";
import { ExternalLink, Server, CheckCircle, XCircle, ShieldCheck } from "lucide-react";

type PteroPanel = {
  id: string;
  name: string;
  url: string;
  isActive: boolean;
  createdAt: string;
  _count: { servers: number; gamePlans: number };
};

export default async function AdminPteroPanelsPage() {
  const res = await serverFetch("/admin/ptero/panels");
  const panels = (res.ok ? await res.json() : []) as PteroPanel[];

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Gaming Cloud</p>
          <h1 className="font-display text-3xl font-semibold">Panels Pterodactyl</h1>
          <p className="text-muted-foreground mt-2">{panels.length} panel(s) configuré(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-4 py-2 text-xs font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Gestion centralisée
          </span>
          <AddPteroPanel />
        </div>
      </div>

      {panels.length === 0 ? (
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Server className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucun panel Pterodactyl configuré</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ajoutez votre panel pour commencer à vendre des serveurs gaming
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {panels.map((panel) => (
            <Card key={panel.id} className="border-border/70 bg-card/80 shadow-sm">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-lg">{panel.name}</p>
                    <a
                      href={panel.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1 mt-0.5"
                    >
                      {panel.url}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  {panel.isActive ? (
                    <CheckCircle className="h-5 w-5 text-emerald-500 mt-1" />
                  ) : (
                    <XCircle className="h-5 w-5 text-rose-500 mt-1" />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md bg-muted/60 px-3 py-2">
                    <p className="text-muted-foreground text-xs">Serveurs déployés</p>
                    <p className="font-display text-xl font-semibold">{panel._count.servers}</p>
                  </div>
                  <div className="rounded-md bg-muted/60 px-3 py-2">
                    <p className="text-muted-foreground text-xs">Offres configurées</p>
                    <p className="font-display text-xl font-semibold">{panel._count.gamePlans}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ajouté le {new Intl.DateTimeFormat("fr-FR").format(new Date(panel.createdAt))}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
