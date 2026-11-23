import type { Category } from "@/types/product.types";
import { daysAgo } from "./helpers";

const cat = (
  id: string,
  name: string,
  slug: string,
  parentId: string | null,
  displayOrder: number,
  description: string,
  kind: Category["kind"] = "category",
): Category => ({
  id,
  name,
  slug,
  description,
  imageUrl: `/images/categories/${slug}.svg`,
  kind,
  parentId,
  displayOrder,
  isArchived: false,
  createdAt: daysAgo(200),
});

export const categoriesMock: Category[] = [
  cat("cat_femme", "Femme", "femme", null, 1, "Robes, hauts, pantalons, vestes et manteaux pensés pour durer."),
  cat("cat_robes", "Robes", "robes", "cat_femme", 1, "Du quotidien aux grandes occasions."),
  cat("cat_hauts", "Hauts & blouses", "hauts-femme", "cat_femme", 2, "Blouses, chemises, t-shirts et polos."),
  cat("cat_pantalons_f", "Pantalons", "pantalons-femme", "cat_femme", 3, "Coupes larges, tailleurs, chinos et jeans."),
  cat("cat_manteaux", "Manteaux", "manteaux-femme", "cat_femme", 4, "Pièces d'extérieur en laine et mélanges nobles."),
  cat("cat_vestes", "Vestes", "vestes", "cat_femme", 5, "Cuir, bombers et pièces de mi-saison."),
  cat("cat_accessoires", "Accessoires", "accessoires", null, 2, "Sacs, foulards, ceintures et écharpes."),
  cat("cat_nouveautes", "Nouveautés", "nouveautes", null, 3, "Les dernières arrivées en boutique.", "collection"),
];
