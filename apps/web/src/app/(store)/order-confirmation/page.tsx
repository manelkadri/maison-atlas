import type { Metadata } from "next";
import { OrderConfirmationView } from "@/components/store/checkout/order-confirmation-view";

export const metadata: Metadata = {
  title: "Commande enregistrée",
  description: "Confirmation de votre commande. Paiement à la livraison.",
  robots: { index: false, follow: false },
};

type OrderConfirmationPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OrderConfirmationPage({ searchParams }: OrderConfirmationPageProps) {
  const raw = (await searchParams).number;
  const number = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 40) || undefined;
  // Mode mock : la commande n'existe que dans le navigateur. Mode API : le suivi exige le couple (numéro, téléphone)
  // mémorisé sur l'appareil, donc la commande est lue côté client (jamais côté serveur : pas de fuite de données).
  return <OrderConfirmationView orderNumber={number} />;
}
