"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getApiBaseUrl } from "@/lib/api";

export default function ConfigureVmPage() {
  const params = useParams<{ planId: string }>();
  const planId = params?.planId as string;
  const [plan, setPlan] = useState<any>(null);
  const [lxcOs, setLxcOs] = useState<any[]>([]);
  const [kvmOs, setKvmOs] = useState<any[]>([]);
  const [os, setOs] = useState("");
  const [rootPassword, setRootPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!planId) return;
    const load = async () => {
      const res = await fetch(`${getApiBaseUrl()}/vms/plans/${planId}/provision`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setPlan(data.plan);
      setLxcOs(data.lxcOsOptions || []);
      setKvmOs(data.kvmOsOptions || []);
      const initial = data.plan.type === "LXC" ? data.lxcOsOptions?.[0]?.id : data.kvmOsOptions?.[0]?.id;
      setOs(initial || "");
    };
    load();
  }, [planId]);

  const submit = async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`${getApiBaseUrl()}/vms/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ planId, os, rootPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Erreur commande");
      setLoading(false);
      return;
    }
    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
      return;
    }
    if (data.vmId) {
      window.location.href = `/vms/${data.vmId}`;
      return;
    }
    setLoading(false);
  };

  if (!plan) return <div>Chargement...</div>;

  const osList = plan.type === "LXC" ? lxcOs : kvmOs;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Configurer {plan.name}</h1>

      <div className="card p-4 space-y-3">
        <div className="text-sm text-muted">Système d'exploitation</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {osList.map((o) => (
            <button
              key={o.id}
              onClick={() => setOs(o.id)}
              className={`card p-3 text-left ${os === o.id ? "border-primary" : ""}`}
            >
              <div className="font-semibold">{o.label}</div>
              <div className="text-xs text-muted">{o.version}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <div className="text-sm text-muted">Mot de passe root (optionnel)</div>
        <input className="input" type="password" value={rootPassword} onChange={(e) => setRootPassword(e.target.value)} />
      </div>

      {error && <div className="text-sm text-red-400">{error}</div>}

      <button className="btn btn-primary" onClick={submit} disabled={loading}>
        {loading ? "Redirection paiement..." : "Payer & Commander"}
      </button>
    </div>
  );
}
