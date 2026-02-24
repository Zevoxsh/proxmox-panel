"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { getApiBaseUrl } from "@/lib/api";
import { clearCart, loadCart, removeFromCart, type CartItem } from "@/lib/cart";
import { toast } from "sonner";

export function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const total = useMemo(
    () => items.reduce((sum, i) => sum + (Number(i.priceMonthly) || 0), 0),
    [items]
  );

  useEffect(() => {
    setItems(loadCart());
  }, []);

  const handleRemove = (item: CartItem) => {
    setItems(removeFromCart(item));
  };

  const handleClear = () => {
    setItems(clearCart());
  };

  const handleCheckout = async () => {
    if (items.length === 0) return;
    try {
      const res = await fetch(`${getApiBaseUrl()}/stripe/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          items: items.map((i) => ({ planId: i.id, type: i.type })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur checkout");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      toast.error("Erreur réseau");
    }
  };

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Panier</h1>
          <p className="text-sm text-muted-foreground">{items.length} article(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Checkout</Badge>
          <Button variant="outline" onClick={handleClear} disabled={items.length === 0}>
            Vider
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Votre panier est vide.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={`${item.type}-${item.id}`}>
              <CardHeader className="pb-2 flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">{item.name}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.type === "VPS" ? "VPS Proxmox" : "Serveur Gaming"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(item.priceMonthly)}</p>
                  <p className="text-xs text-muted-foreground">/mois</p>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <Badge variant="secondary">{item.type}</Badge>
                <Button variant="ghost" onClick={() => handleRemove(item)}>
                  Supprimer
                </Button>
              </CardContent>
            </Card>
          ))}
          <div className="flex items-center justify-between border-t border-border/60 pt-4">
            <div>
              <p className="text-sm text-muted-foreground">Total mensuel</p>
              <p className="text-xl font-semibold">{formatCurrency(total)}</p>
            </div>
            <Button onClick={handleCheckout}>
              Passer au paiement
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
