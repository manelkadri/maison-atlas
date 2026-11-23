import { ToneBadge } from "@/components/ui/status-badge";
import { getPaymentDisplay } from "@/features/orders/logic";
import type { Order } from "@/types/order.types";

/** Paiement à la livraison : « À encaisser » / « Encaissé » / « Échec » / « Sans objet » (commande annulée ou refusée). */
export function PaymentBadge({ order }: { order: Pick<Order, "paymentStatus" | "status"> }) {
  const { label, tone } = getPaymentDisplay(order);
  return <ToneBadge tone={tone}>{label}</ToneBadge>;
}
