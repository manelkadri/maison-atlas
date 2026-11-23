import type { Metadata } from "next";
import { CartView } from "@/components/store/cart/cart-view";

export const metadata: Metadata = {
  title: "Mon panier",
  description: "Vérifiez vos articles, estimez la livraison et passez commande. Paiement à la livraison.",
  robots: { index: false, follow: true },
};

export default function CartPage() {
  return <CartView />;
}
