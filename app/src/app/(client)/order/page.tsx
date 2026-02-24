import { auth } from "@/lib/auth";
import { serverFetch } from "@/lib/server-api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Gamepad2, Server } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";

type VmPlan = {
  id: string;
  name: string;
  description: string | null;
  cpu: number;
  ramMb: number;
  diskGb: number;
  bandwidthGb?: number | null;
  priceMonthly: number;
  type: string;
};

type GamePlan = {
  id: string;
  name: string;
  description: string | null;
  game: string;
  cpu: number;
  ramMb: number;
  diskMb: number;
  priceMonthly: number;
};

function fmtRam(mb: number) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} Go` : `${mb} Mo`;
}
function fmtBandwidth(gb: number | null | undefined) {
  if (!gb) return "Illimitée";
  return gb >= 1000 ? `${(gb / 1000).toFixed(gb % 1000 === 0 ? 0 : 1)} To` : `${gb} Go`;
}

export default async function OrderPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [vmRes, gameRes] = await Promise.all([
    serverFetch("/vms/plans"),
    serverFetch("/game-servers/plans"),
  ]);
  const vmPlans = (vmRes.ok ? await vmRes.json() : []) as VmPlan[];
  const gamePlans = (gameRes.ok ? await gameRes.json() : []) as GamePlan[];

  const lxcPlans = vmPlans.filter((p) => p.type === "LXC");
  const kvmPlans = vmPlans.filter((p) => p.type === "KVM");

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Commander</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Catalogue clair, déploiement rapide, sans engagement.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Catalogue</Badge>
        </div>
      </div>

      <Tabs defaultValue="vps" className="space-y-4">
        <TabsList>
          <TabsTrigger value="vps">VPS</TabsTrigger>
          <TabsTrigger value="gaming">Gaming</TabsTrigger>
        </TabsList>

        <TabsContent value="vps" className="space-y-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Server className="h-4 w-4" />
            Proxmox · LXC et KVM
          </div>

          {vmPlans.length === 0 ? (
            <Card className="bg-card/60">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Aucun plan VPS disponible.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {lxcPlans.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-sm font-medium">Conteneurs LXC</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {lxcPlans.map((plan, i) => (
                      <Card key={plan.id} className={i === 1 ? "border-primary" : ""}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <CardTitle className="text-base">{plan.name}</CardTitle>
                              {plan.description && (
                                <CardDescription className="mt-1">{plan.description}</CardDescription>
                              )}
                            </div>
                            {i === 1 && <Badge className="text-xs">Populaire</Badge>}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-semibold">{formatCurrency(plan.priceMonthly)}</span>
                            <span className="text-xs text-muted-foreground">/mois</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-primary" />
                              {plan.cpu} vCPU
                            </div>
                            <div className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-primary" />
                              {fmtRam(plan.ramMb)}
                            </div>
                            <div className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-primary" />
                              {plan.diskGb} Go SSD
                            </div>
                            <div className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-primary" />
                              {fmtBandwidth(plan.bandwidthGb)}
                            </div>
                          </div>
                          <Button asChild className="w-full">
                            <Link href={`/vms/new/${plan.id}`}>Configurer</Link>
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              )}

              {kvmPlans.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-sm font-medium">Serveurs KVM</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {kvmPlans.map((plan, i) => (
                      <Card key={plan.id} className={i === 1 ? "border-primary" : ""}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <CardTitle className="text-base">{plan.name}</CardTitle>
                              {plan.description && (
                                <CardDescription className="mt-1">{plan.description}</CardDescription>
                              )}
                            </div>
                            {i === 1 && <Badge className="text-xs">Populaire</Badge>}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-semibold">{formatCurrency(plan.priceMonthly)}</span>
                            <span className="text-xs text-muted-foreground">/mois</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-primary" />
                              {plan.cpu} vCPU
                            </div>
                            <div className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-primary" />
                              {fmtRam(plan.ramMb)}
                            </div>
                            <div className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-primary" />
                              {plan.diskGb} Go SSD
                            </div>
                            <div className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-primary" />
                              {fmtBandwidth(plan.bandwidthGb)}
                            </div>
                          </div>
                          <Button asChild className="w-full">
                            <Link href={`/vms/new/${plan.id}`}>Configurer</Link>
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="gaming" className="space-y-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Gamepad2 className="h-4 w-4" />
            Déploiement automatisé Pterodactyl
          </div>

          {gamePlans.length === 0 ? (
            <Card className="bg-card/60">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Aucun plan gaming disponible.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {gamePlans.map((plan, i) => (
                <Card key={plan.id} className={i === 1 ? "border-primary" : ""}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{plan.name}</CardTitle>
                        <CardDescription className="mt-1 capitalize">{plan.game}</CardDescription>
                      </div>
                      {i === 1 && <Badge className="text-xs">Populaire</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-semibold">{formatCurrency(plan.priceMonthly)}</span>
                      <span className="text-xs text-muted-foreground">/mois</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        {plan.cpu} vCPU
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        {fmtRam(plan.ramMb)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        {plan.diskMb} Mo SSD
                      </div>
                    </div>
                    <Button asChild className="w-full">
                      <Link href="/game-servers/new">Configurer</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
import Link from "next/link";
