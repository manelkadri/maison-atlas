import type { Metadata } from "next";
import { CategoryList } from "@/components/admin/categories/category-list";

export const metadata: Metadata = { title: "Catégories" };

export default function CategoriesPage() {
  return <CategoryList />;
}
