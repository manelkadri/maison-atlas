import type { Metadata } from "next";
import { ProductList } from "@/components/admin/products/product-list";

export const metadata: Metadata = { title: "Produits" };

export default function ProductsPage() {
  return <ProductList />;
}
