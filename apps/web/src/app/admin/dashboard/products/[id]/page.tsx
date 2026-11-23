import { redirect } from "next/navigation";

/** Pas de fiche de consultation séparée : on ouvre directement le formulaire de modification. */
export default async function ProductDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/dashboard/products/${id}/edit`);
}
