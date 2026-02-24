"use client";

import { useState } from "react";
import { getApiBaseUrl } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await fetch(`${getApiBaseUrl()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur de connexion");
      return;
    }
    window.location.href = "/dashboard";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base p-6">
      <form onSubmit={submit} className="card w-full max-w-md p-6 space-y-4">
        <div>
          <h1 className="font-display text-2xl">Connexion</h1>
          <p className="text-sm text-muted">Accédez à votre espace</p>
        </div>
        {error && <div className="text-sm text-red-400">{error}</div>}
        <div>
          <label className="label">Email</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label">Mot de passe</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn btn-primary w-full" type="submit">Se connecter</button>
        <a className="text-sm text-muted" href="/register">Créer un compte</a>
      </form>
    </div>
  );
}
