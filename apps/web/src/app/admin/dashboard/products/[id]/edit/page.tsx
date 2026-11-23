import type { Metadata } from "next";
import { ProductEditView } from "@/components/admin/products/product-edit-view";

export const metadata: Metadata = { title: "Modifier le produit" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductEditView id={id} />;
}
