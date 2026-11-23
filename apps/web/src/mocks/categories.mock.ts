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
  cat("cat_femme", "Femme", "femme", null, 1, "Robes, hauts, pantalons et manteaux pensés pour durer."),
  cat("cat_robes", "Robes", "robes", "cat_femme", 1, "Du quotidien aux grandes occasions."),
  cat("cat_hauts", "Hauts & blouses", "hauts-femme", "cat_femme", 2, "Blouses fluides et chemisiers élégants."),
  cat("cat_pantalons_f", "Pantalons", "pantalons-femme", "cat_femme", 3, "Coupes larges et tailleurs fluides."),
  cat("cat_manteaux", "Manteaux", "manteaux-femme", "cat_femme", 4, "Pièces d'extérieur en laine et mélanges nobles."),
  cat("cat_homme", "Homme", "homme", null, 2, "Une garde-robe masculine sobre et soignée."),
  cat("cat_chemises", "Chemises", "chemises", "cat_homme", 1, "Oxford, lin et cols classiques."),
  cat("cat_tshirts", "T-shirts & polos", "t-shirts-polos", "cat_homme", 2, "Les basiques en coton premium."),
  cat("cat_pantalons_h", "Pantalons", "pantalons-homme", "cat_homme", 3, "Chinos et jeans de coupe droite."),
  cat("cat_vestes", "Vestes", "vestes", "cat_homme", 4, "Cuir, bombers et pièces de mi-saison."),
  cat("cat_accessoires", "Accessoires", "accessoires", null, 3, "Sacs, foulards, ceintures et écharpes."),
  cat("cat_nouveautes", "Nouveautés", "nouveautes", null, 4, "Les dernières arrivées en boutique.", "collection"),
];
