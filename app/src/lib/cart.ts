export type CartItemType = "VPS" | "GAME";

export type CartItem = {
  id: string;
  type: CartItemType;
  name: string;
  priceMonthly: number;
};

const STORAGE_KEY = "pp_cart";

export function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function addToCart(item: CartItem) {
  const current = loadCart();
  const next = current.filter((i) => !(i.id === item.id && i.type === item.type));
  next.push(item);
  saveCart(next);
  return next;
}

export function removeFromCart(item: CartItem) {
  const current = loadCart();
  const next = current.filter((i) => !(i.id === item.id && i.type === item.type));
  saveCart(next);
  return next;
}

export function clearCart() {
  saveCart([]);
  return [];
}
