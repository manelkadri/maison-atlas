import type { Metadata } from "next";
import { OrderDetail } from "@/components/store/account/order-detail";

type PageProps = { params: Promise<{ orderNumber: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orderNumber } = await params;
  return { title: `Commande ${decodeURIComponent(orderNumber)}` };
}

export default async function AccountOrderPage({ params }: PageProps) {
  const { orderNumber } = await params;
  return <OrderDetail orderNumber={decodeURIComponent(orderNumber)} />;
}
