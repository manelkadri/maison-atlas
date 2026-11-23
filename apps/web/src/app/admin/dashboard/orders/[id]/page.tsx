import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { OrderDetailView } from "@/components/admin/orders/order-detail-view";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Détail de la commande" };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <div className="no-print">
        <PageHeader
          title="Détail de la commande"
          description="Client, articles, suivi des statuts et bon de commande à imprimer."
          actions={
            <Button asChild variant="outline">
              <Link href="/admin/dashboard/orders">
                <ArrowLeft aria-hidden /> Toutes les commandes
              </Link>
            </Button>
          }
        />
      </div>
      <OrderDetailView id={id} />
    </>
  );
}
