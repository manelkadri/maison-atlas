import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { CustomersView } from "@/components/admin/customers/customers-view";

export const metadata: Metadata = { title: "Clients" };

export default function CustomersPage() {
  return (
    <>
      <PageHeader title="Clients" description="Coordonnées, historique d'achats et fiabilité de chaque client." />
      <CustomersView />
    </>
  );
}
