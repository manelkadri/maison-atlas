import type { Metadata } from "next";
import { FavoritesView } from "@/components/store/catalog/favorites-view";

export const metadata: Metadata = {
  title: "Mes favoris",
  description: "Retrouvez les articles que vous avez enregistrés.",
  robots: { index: false, follow: true },
};

export default function FavoritesPage() {
  return <FavoritesView />;
}
