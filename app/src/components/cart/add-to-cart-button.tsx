"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { addToCart, type CartItem } from "@/lib/cart";
import { toast } from "sonner";

export function AddToCartButton({ item }: { item: CartItem }) {
  const [loading, setLoading] = useState(false);

  return (
    <Button
      className="w-full"
      disabled={loading}
      onClick={() => {
        setLoading(true);
        const next = addToCart(item);
        toast.success(`Ajouté au panier (${next.length})`);
        setLoading(false);
      }}
    >
      Ajouter au panier
    </Button>
  );
}
