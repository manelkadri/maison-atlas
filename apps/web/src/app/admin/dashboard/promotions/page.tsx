import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { PromotionsView } from "@/components/admin/promotions/promotions-view";

export const metadata: Metadata = { title: "Promotions" };

export default function PromotionsPage() {
  return (
    <>
      <PageHeader title="Promotions" description="Codes promotionnels : création, période de validité, activation et simulation." />
      <PromotionsView />
    </>
  );
}
