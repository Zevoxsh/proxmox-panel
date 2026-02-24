"use client";

import { useState } from "react";
import { getApiBaseUrl } from "@/lib/api";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await fetch(`${getApiBaseUrl()}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur d'inscription");
      return;
    }
    window.location.href = "/dashboard";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base p-6">
      <form onSubmit={submit} className="card w-full max-w-md p-6 space-y-4">
        <div>
          <h1 className="font-display text-2xl">Créer un compte</h1>
          <p className="text-sm text-muted">Accès immédiat au panel</p>
        </div>
        {error && <div className="text-sm text-red-400">{error}</div>}
        <div>
          <label className="label">Nom</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label">Mot de passe</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn btn-primary w-full" type="submit">Créer</button>
        <a className="text-sm text-muted" href="/login">J'ai déjà un compte</a>
      </form>
    </div>
  );
}
