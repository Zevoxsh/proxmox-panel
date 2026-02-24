"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/lib/api";

export function DeleteVmPlanButton({ planId }: { planId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Supprimer ce plan VPS ?")) return;
    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/vm-plans/${planId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur");
      } else {
        toast.success("Plan supprimé");
        router.refresh();
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={handleDelete} disabled={loading}>
      Supprimer
    </Button>
  );
}
