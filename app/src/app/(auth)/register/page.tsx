"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Server, Eye, EyeOff, Loader2, Zap, Shield, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/lib/api";

const features = [
  { icon: Zap, text: "Déploiement LXC & KVM en quelques secondes" },
  { icon: BarChart3, text: "Métriques temps réel CPU, RAM, Disque" },
  { icon: Shield, text: "Facturation Stripe & gestion des abonnements" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    if (form.password.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur lors de l'inscription");
      } else {
        toast.success("Compte créé ! Vous pouvez vous connecter.");
        router.push("/login");
      }
    } catch {
      toast.error("Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Panneau branding ── */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[520px] flex-shrink-0 flex-col relative overflow-hidden border-r border-border">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full bg-primary/12 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full bg-primary/6 blur-[80px] pointer-events-none" />

        <div className="relative z-10 flex flex-col h-full p-12">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
              <Server className="w-[18px] h-[18px] text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight">ProxPanel</span>
          </div>

          <div className="flex-1 flex flex-col justify-center py-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-xs font-medium text-primary mb-6 w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-ring" />
              Inscription gratuite
            </div>
            <h1 className="font-display text-4xl xl:text-5xl font-bold leading-[1.1] mb-5">
              Démarrez
              <br />
              <span className="text-primary">dès maintenant</span>
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed mb-10 max-w-sm">
              Créez votre compte et déployez votre premier VPS en quelques minutes.
            </p>

            <div className="space-y-3">
              {features.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-primary/12 flex items-center justify-center flex-shrink-0 border border-primary/20">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="text-sm text-muted-foreground">{text}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground/40">ProxPanel · Proxmox VPS Management</p>
        </div>
      </div>

      {/* ── Panneau formulaire ── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[360px]">
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
              <Server className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold">ProxPanel</span>
          </div>

          <div className="mb-8">
            <h2 className="font-display text-2xl font-bold">Créer un compte</h2>
            <p className="text-muted-foreground text-sm mt-1.5">Rejoignez ProxPanel en quelques secondes</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium text-foreground/90">Nom complet</Label>
              <Input
                id="name"
                placeholder="Jean Dupont"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="h-11 bg-secondary/60 border-border/80 placeholder:text-muted-foreground/50 focus-visible:border-primary/60 focus-visible:ring-primary/20"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-foreground/90">Adresse email</Label>
              <Input
                id="email"
                type="email"
                placeholder="vous@exemple.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="h-11 bg-secondary/60 border-border/80 placeholder:text-muted-foreground/50 focus-visible:border-primary/60 focus-visible:ring-primary/20"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-foreground/90">
                Mot de passe <span className="text-muted-foreground font-normal">(min. 8 caractères)</span>
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  className="h-11 bg-secondary/60 border-border/80 placeholder:text-muted-foreground/50 focus-visible:border-primary/60 focus-visible:ring-primary/20 pr-11"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-sm font-medium text-foreground/90">Confirmer le mot de passe</Label>
              <Input
                id="confirm"
                type={showPassword ? "text" : "password"}
                placeholder="Répétez le mot de passe"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                required
                className="h-11 bg-secondary/60 border-border/80 placeholder:text-muted-foreground/50 focus-visible:border-primary/60 focus-visible:ring-primary/20"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 mt-1 font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow"
              disabled={loading}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Créer mon compte
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border/60 text-center text-sm text-muted-foreground">
            Déjà un compte ?{" "}
            <Link
              href="/login"
              className="text-primary font-medium hover:text-primary/80 transition-colors underline underline-offset-4 decoration-primary/30"
            >
              Se connecter
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
