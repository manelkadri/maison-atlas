import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { CustomerDetailView } from "@/components/admin/customers/customer-detail-view";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Fiche client" };

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <PageHeader
        title="Fiche client"
        description="Coordonnées, indicateurs et historique des commandes."
        actions={
          <Button asChild variant="outline">
            <Link href="/admin/dashboard/customers">
              <ArrowLeft aria-hidden /> Tous les clients
            </Link>
          </Button>
        }
      />
      <CustomerDetailView id={id} />
    </>
  );
}
