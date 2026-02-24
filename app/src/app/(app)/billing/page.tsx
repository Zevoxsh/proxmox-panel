"use client";

import { useEffect, useState } from "react";
import { getApiBaseUrl } from "@/lib/api";

export default function BillingPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`${getApiBaseUrl()}/billing`, { credentials: "include" });
      if (!res.ok) return;
      setData(await res.json());
    };
    load();
  }, []);

  const openPortal = async () => {
    const res = await fetch(`${getApiBaseUrl()}/stripe/portal`, { method: "POST", credentials: "include" });
    const payload = await res.json().catch(() => ({}));
    if (payload.url) window.location.href = payload.url;
  };

  const subs = data?.subscriptions || [];
  const gameSubs = data?.gameSubscriptions || [];
  const invoices = data?.invoices || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl">Facturation</h1>
        <p className="text-sm text-muted">Abonnements et factures</p>
      </div>

      <button className="btn btn-outline" onClick={openPortal}>Gérer mes abonnements</button>

      <section className="card p-4">
        <div className="font-semibold mb-3">Abonnements VPS</div>
        {subs.length === 0 ? (
          <div className="text-sm text-muted">Aucun abonnement</div>
        ) : (
          <div className="space-y-2">
            {subs.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between border-b border-border pb-2">
                <div>
                  <div className="font-medium">{s.plan_name}</div>
                  <div className="text-xs text-muted">{s.status}</div>
                </div>
                <div className="text-xs text-muted">{new Date(s.current_period_end).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-4">
        <div className="font-semibold mb-3">Abonnements Gaming</div>
        {gameSubs.length === 0 ? (
          <div className="text-sm text-muted">Aucun abonnement</div>
        ) : (
          <div className="space-y-2">
            {gameSubs.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between border-b border-border pb-2">
                <div>
                  <div className="font-medium">{s.plan_name}</div>
                  <div className="text-xs text-muted">{s.status}</div>
                </div>
                <div className="text-xs text-muted">{new Date(s.current_period_end).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-4">
        <div className="font-semibold mb-3">Factures</div>
        {invoices.length === 0 ? (
          <div className="text-sm text-muted">Aucune facture</div>
        ) : (
          <div className="space-y-2">
            {invoices.map((i: any) => (
              <div key={i.id} className="flex items-center justify-between border-b border-border pb-2">
                <div>
                  <div className="font-medium">{i.amount} {i.currency}</div>
                  <div className="text-xs text-muted">{i.status}</div>
                </div>
                <div className="text-xs text-muted">{new Date(i.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
