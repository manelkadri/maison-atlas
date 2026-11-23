"use client";

import Link from "next/link";
import { PackageX, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ADMIN_ROOT } from "@/config/admin-nav";
import { useProductById } from "@/features/products/hooks";
import { getErrorMessage } from "@/services";
import { ProductForm, ProductFormBreadcrumb } from "./product-form";

/** Charge le produit puis affiche le formulaire (le formulaire n'est monté qu'une fois les données disponibles). */
export function ProductEditView({ id }: { id: string }) {
  const { data, isPending, isError, error, refetch } = useProductById(id);

  if (isPending) {
    return (
      <div role="status" aria-busy="true" aria-label="Chargement du produit" className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <Skeleton className="hidden h-48 lg:block" />
          <div className="space-y-6">
            <Skeleton className="h-96" />
            <Skeleton className="h-60" />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Modifier le produit" />
        <EmptyState
          icon={PackageX}
          title="Impossible de charger le produit"
          description={getErrorMessage(error)}
          action={
            <Button variant="outline" onClick={() => void refetch()}>
              <RefreshCw aria-hidden /> Réessayer
            </Button>
          }
        />
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PageHeader title="Produit introuvable" />
        <EmptyState
          icon={PackageX}
          title="Ce produit n'existe pas"
          description="Il a peut-être été supprimé. Retournez à la liste pour en choisir un autre."
          action={
            <Button asChild>
              <Link href={`${ADMIN_ROOT}/products`}>Retour aux produits</Link>
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <ProductFormBreadcrumb product={data} />
      <ProductForm key={data.id} mode="edit" product={data} />
    </>
  );
}
