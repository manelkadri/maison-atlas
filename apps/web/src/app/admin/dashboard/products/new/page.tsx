import type { Metadata } from "next";
import { ProductForm } from "@/components/admin/products/product-form";

export const metadata: Metadata = { title: "Nouveau produit" };

export default function NewProductPage() {
  return <ProductForm mode="create" />;
}
