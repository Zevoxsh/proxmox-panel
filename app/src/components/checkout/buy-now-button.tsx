"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getApiBaseUrl } from "@/lib/api";
import { toast } from "sonner";

export function BuyNowButton({
  planId,
  planType,
  label = "Payer & Commander",
}: {
  planId: string;
  planType: "VPS" | "GAME";
  label?: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/stripe/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ planId, type: planType }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur checkout");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button className="w-full" onClick={handleClick} disabled={loading}>
      {loading ? "Redirection..." : label}
    </Button>
  );
}
