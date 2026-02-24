"use client";

import { useEffect, useState } from "react";
import { getApiBaseUrl } from "@/lib/api";
import { useSearchParams } from "next/navigation";

export default function GameServerNewPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [planId, setPlanId] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const search = useSearchParams();

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`${getApiBaseUrl()}/game-servers/plans`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setPlans(data);
      const qp = search.get("planId");
      setPlanId(qp || data?.[0]?.id || "");
    };
    load();
  }, [search]);

  const submit = async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`${getApiBaseUrl()}/game-servers/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ planId, name }),
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
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Nouveau serveur gaming</h1>
      <div className="card p-4 space-y-3">
        <div className="text-sm text-muted">Plan</div>
        <select className="input" value={planId} onChange={(e) => setPlanId(e.target.value)}>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>{p.name} — {p.priceMonthly} €/mois</option>
          ))}
        </select>
      </div>
      <div className="card p-4 space-y-3">
        <div className="text-sm text-muted">Nom</div>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      {error && <div className="text-sm text-red-400">{error}</div>}
      <button className="btn btn-primary" onClick={submit} disabled={loading}>
        {loading ? "Redirection paiement..." : "Payer & Commander"}
      </button>
    </div>
  );
}
