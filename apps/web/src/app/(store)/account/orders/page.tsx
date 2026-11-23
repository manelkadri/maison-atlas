import type { Metadata } from "next";
import { OrdersList } from "@/components/store/account/orders-list";

export const metadata: Metadata = { title: "Mes commandes" };

export default function AccountOrdersPage() {
  return <OrdersList />;
}
