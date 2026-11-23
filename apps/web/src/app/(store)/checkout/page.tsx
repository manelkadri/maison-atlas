import type { Metadata } from "next";
import { CheckoutView } from "@/components/store/checkout/checkout-view";

export const metadata: Metadata = {
  title: "Finaliser ma commande",
  description: "Renseignez vos coordonnées et votre adresse de livraison. Paiement à la livraison.",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return <CheckoutView />;
}
