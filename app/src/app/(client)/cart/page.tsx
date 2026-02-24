import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CartPage } from "@/components/cart/cart-page";

export default async function CartRoutePage() {
  const session = await auth();
  if (!session) redirect("/login");
  return <CartPage />;
}
