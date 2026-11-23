import type { Gender, Product, ProductImage, ProductVariant } from "@/types/product.types";
import { buildSku, slugify } from "@fashion/shared";
import { daysAgo } from "./helpers";

type Color = readonly [name: string, hex: string];

type ProductSeed = {
  slug: string;
  name: string;
  reference: string;
  categoryId: string;
  gender: Gender;
  price: number;
  compareAtPrice?: number;
  costRatio?: number;
  description: string;
  tags: string[];
  colors: readonly Color[];
  sizes: readonly string[];
  createdDaysAgo: number;
  soldCount: number;
  featured?: boolean;
  published?: boolean;
  archived?: boolean;
};

/**
 * Répartition de stock déterministe (pas de Math.random : SSR et navigateur doivent produire
 * exactement les mêmes données). Contient volontairement des ruptures et des stocks faibles.
 */
const STOCK_PATTERN = [14, 9, 0, 6, 22, 2, 11, 8, 3, 17, 1, 25, 5, 12, 0, 7, 19, 4, 10, 2, 15, 6, 9, 0];

const SEEDS: ProductSeed[] = [
  {
    slug: "robe-midi-satinee",
    name: "Robe midi satinée",
    reference: "ATL-F-001",
    categoryId: "cat_robes",
    gender: "women",
    price: 12900,
    compareAtPrice: 15900,
    description:
      "Robe midi à la coupe fluide dans un satin mat au tombé impeccable. Col V souple, taille légèrement marquée et finitions soignées : une pièce habillée qui se porte aussi bien en soirée qu'avec des baskets blanches.",
    tags: ["robe", "soirée", "satin"],
    colors: [["Noir", "#1a1a1a"], ["Beige", "#d8c3a5"], ["Bordeaux", "#6d1f2c"]],
    sizes: ["S", "M", "L", "XL"],
    createdDaysAgo: 6,
    soldCount: 148,
    featured: true,
  },
  {
    slug: "robe-longue-en-lin",
    name: "Robe longue en lin",
    reference: "ATL-F-002",
    categoryId: "cat_robes",
    gender: "women",
    price: 9800,
    description:
      "Robe longue en lin lavé, légère et respirante. Boutons nacrés sur le devant, poches cachées et ceinture à nouer. Idéale pour les journées chaudes, elle se froisse avec élégance.",
    tags: ["robe", "lin", "été"],
    colors: [["Blanc cassé", "#f2eee6"], ["Terracotta", "#b4654a"]],
    sizes: ["S", "M", "L"],
    createdDaysAgo: 12,
    soldCount: 96,
  },
  {
    slug: "blouse-en-soie-fluide",
    name: "Blouse en soie fluide",
    reference: "ATL-F-003",
    categoryId: "cat_hauts",
    gender: "women",
    price: 6900,
    description:
      "Blouse à manches longues dans une soie fluide au toucher doux. Col lavallière à nouer ou à porter ouvert, poignets boutonnés. Une pièce intemporelle qui s'associe à tout.",
    tags: ["blouse", "soie", "bureau"],
    colors: [["Ivoire", "#efe8d8"], ["Noir", "#1a1a1a"], ["Sauge", "#9aa58c"]],
    sizes: ["XS", "S", "M", "L"],
    createdDaysAgo: 40,
    soldCount: 121,
    featured: true,
  },
  {
    slug: "chemisier-col-noue",
    name: "Chemisier à col noué",
    reference: "ATL-F-004",
    categoryId: "cat_hauts",
    gender: "women",
    price: 5400,
    compareAtPrice: 6900,
    description:
      "Chemisier en popeline de coton, col à nouer et manches légèrement bouffantes. Coupe droite, longueur hanches. Facile à porter, facile à repasser.",
    tags: ["chemisier", "coton", "bureau"],
    colors: [["Blanc", "#ffffff"], ["Bleu ciel", "#bcd0e0"]],
    sizes: ["S", "M", "L", "XL"],
    createdDaysAgo: 75,
    soldCount: 64,
  },
  {
    slug: "pantalon-large-taille-haute",
    name: "Pantalon large taille haute",
    reference: "ATL-F-005",
    categoryId: "cat_pantalons_f",
    gender: "women",
    price: 7800,
    description:
      "Pantalon large à taille haute et pinces marquées. Tissu fluide à l'allure de tailleur, braguette zippée et deux poches latérales. Longueur cheville pour mettre en valeur vos chaussures.",
    tags: ["pantalon", "tailleur", "large"],
    colors: [["Noir", "#1a1a1a"], ["Camel", "#b08a5b"], ["Gris", "#8a8a88"]],
    sizes: ["36", "38", "40", "42", "44"],
    createdDaysAgo: 22,
    soldCount: 134,
    featured: true,
  },
  {
    slug: "pantalon-tailleur-fluide",
    name: "Pantalon tailleur fluide",
    reference: "ATL-F-006",
    categoryId: "cat_pantalons_f",
    gender: "women",
    price: 8900,
    description:
      "Pantalon de tailleur à jambe droite, plis sur le devant et ceinture ajustable. Un tombé fluide, une tenue de confiance du bureau à la soirée.",
    tags: ["pantalon", "tailleur", "bureau"],
    colors: [["Noir", "#1a1a1a"], ["Beige", "#d8c3a5"]],
    sizes: ["36", "38", "40", "42", "44"],
    createdDaysAgo: 4,
    soldCount: 38,
  },
  {
    slug: "manteau-long-en-laine",
    name: "Manteau long en laine",
    reference: "ATL-F-007",
    categoryId: "cat_manteaux",
    gender: "women",
    price: 24500,
    compareAtPrice: 29000,
    description:
      "Manteau long en mélange de laine, coupe droite et épaules relâchées. Doublure satinée, fermeture croisée à boutons, deux poches plaquées. L'investissement de la saison froide.",
    tags: ["manteau", "laine", "hiver"],
    colors: [["Camel", "#b08a5b"], ["Noir", "#1a1a1a"], ["Gris chiné", "#9b9a97"]],
    sizes: ["S", "M", "L", "XL"],
    createdDaysAgo: 18,
    soldCount: 57,
    featured: true,
  },
  {
    slug: "chemise-oxford",
    name: "Chemise oxford",
    reference: "ATL-H-001",
    categoryId: "cat_chemises",
    gender: "men",
    price: 5900,
    description:
      "Chemise oxford en coton épais, col boutonné et coupe régulière. Se porte rentrée ou sortie, avec un jean comme avec un chino. Les coutures renforcées garantissent plusieurs années d'usage.",
    tags: ["chemise", "coton", "classique"],
    colors: [["Blanc", "#ffffff"], ["Bleu ciel", "#bcd0e0"], ["Rose poudré", "#e3c3c0"]],
    sizes: ["S", "M", "L", "XL", "XXL"],
    createdDaysAgo: 55,
    soldCount: 162,
    featured: true,
  },
  {
    slug: "chemise-en-lin",
    name: "Chemise en lin",
    reference: "ATL-H-002",
    categoryId: "cat_chemises",
    gender: "men",
    price: 6400,
    description:
      "Chemise en lin pur, col italien et manches longues roulables. Matière respirante et texture naturelle pour les saisons chaudes.",
    tags: ["chemise", "lin", "été"],
    colors: [["Sable", "#d9ccb0"], ["Bleu marine", "#1f2f4a"]],
    sizes: ["M", "L", "XL"],
    createdDaysAgo: 9,
    soldCount: 71,
  },
  {
    slug: "t-shirt-coton-premium",
    name: "T-shirt coton premium",
    reference: "ATL-H-003",
    categoryId: "cat_tshirts",
    gender: "men",
    price: 2900,
    description:
      "T-shirt en jersey de coton peigné 220 g/m², col rond côtelé et coupe droite. Un basique dense qui ne se déforme pas au lavage.",
    tags: ["t-shirt", "basique", "coton"],
    colors: [["Blanc", "#ffffff"], ["Noir", "#1a1a1a"], ["Gris chiné", "#9b9a97"], ["Marine", "#1f2f4a"]],
    sizes: ["S", "M", "L", "XL", "XXL"],
    createdDaysAgo: 120,
    soldCount: 310,
  },
  {
    slug: "polo-pique",
    name: "Polo piqué",
    reference: "ATL-H-004",
    categoryId: "cat_tshirts",
    gender: "men",
    price: 3900,
    description:
      "Polo en maille piquée de coton, patte à trois boutons et finitions côtelées. Coupe ajustée sans être près du corps.",
    tags: ["polo", "coton", "classique"],
    colors: [["Marine", "#1f2f4a"], ["Blanc", "#ffffff"], ["Vert forêt", "#2f4a3a"]],
    sizes: ["S", "M", "L", "XL"],
    createdDaysAgo: 30,
    soldCount: 142,
  },
  {
    slug: "pantalon-chino",
    name: "Pantalon chino",
    reference: "ATL-H-005",
    categoryId: "cat_pantalons_h",
    gender: "men",
    price: 6900,
    description:
      "Chino en sergé de coton stretch, coupe fuselée et taille à passants. Confort quotidien, allure soignée.",
    tags: ["chino", "coton", "classique"],
    colors: [["Beige", "#d8c3a5"], ["Marine", "#1f2f4a"], ["Olive", "#6b6a3f"]],
    sizes: ["38", "40", "42", "44", "46"],
    createdDaysAgo: 65,
    soldCount: 117,
  },
  {
    slug: "jean-droit-brut",
    name: "Jean droit brut",
    reference: "ATL-H-006",
    categoryId: "cat_pantalons_h",
    gender: "men",
    price: 7500,
    compareAtPrice: 8900,
    description:
      "Jean en denim brut 12 oz, coupe droite, cinq poches et boutons métalliques. Il se patine et se personnalise au fil du temps.",
    tags: ["jean", "denim"],
    colors: [["Bleu brut", "#2a3a55"], ["Noir", "#1a1a1a"]],
    sizes: ["38", "40", "42", "44", "46"],
    createdDaysAgo: 85,
    soldCount: 189,
  },
  {
    slug: "veste-en-cuir",
    name: "Veste en cuir",
    reference: "ATL-H-007",
    categoryId: "cat_vestes",
    gender: "men",
    price: 28900,
    description:
      "Veste en cuir d'agneau pleine fleur, col montant, fermeture zippée et doublure en coton. Un classique qui prend de la valeur avec le temps.",
    tags: ["veste", "cuir"],
    colors: [["Noir", "#1a1a1a"], ["Brun", "#4a3426"]],
    sizes: ["M", "L", "XL"],
    createdDaysAgo: 3,
    soldCount: 22,
    featured: true,
  },
  {
    slug: "blouson-bomber",
    name: "Blouson bomber",
    reference: "ATL-H-008",
    categoryId: "cat_vestes",
    gender: "men",
    price: 13500,
    description:
      "Bomber en twill de coton déperlant, poignets et bas côtelés, poche zippée sur la manche. Léger et chaud pour la mi-saison.",
    tags: ["bomber", "veste", "mi-saison"],
    colors: [["Olive", "#6b6a3f"], ["Noir", "#1a1a1a"]],
    sizes: ["S", "M", "L", "XL"],
    createdDaysAgo: 15,
    soldCount: 83,
  },
  {
    slug: "sac-cabas-en-cuir",
    name: "Sac cabas en cuir",
    reference: "ATL-A-001",
    categoryId: "cat_accessoires",
    gender: "women",
    price: 14500,
    description:
      "Grand cabas en cuir grainé, anses cousues main et fermeture aimantée. Poche zippée intérieure, assez spacieux pour un ordinateur 14 pouces.",
    tags: ["sac", "cuir", "cabas"],
    colors: [["Noir", "#1a1a1a"], ["Camel", "#b08a5b"]],
    sizes: ["Unique"],
    createdDaysAgo: 8,
    soldCount: 74,
    featured: true,
  },
  {
    slug: "foulard-en-soie",
    name: "Foulard en soie",
    reference: "ATL-A-002",
    categoryId: "cat_accessoires",
    gender: "women",
    price: 2800,
    compareAtPrice: 3500,
    description:
      "Carré de soie 70 × 70 cm aux bords roulottés à la main. À nouer dans les cheveux, autour du cou ou sur un sac.",
    tags: ["foulard", "soie"],
    colors: [["Rouille", "#a2522f"], ["Bleu nuit", "#1c2540"], ["Ivoire", "#efe8d8"]],
    sizes: ["Unique"],
    createdDaysAgo: 48,
    soldCount: 59,
  },
  {
    slug: "ceinture-en-cuir",
    name: "Ceinture en cuir",
    reference: "ATL-A-003",
    categoryId: "cat_accessoires",
    gender: "unisex",
    price: 3600,
    description:
      "Ceinture en cuir de vachette de 3 cm, boucle en laiton brossé. Se porte aussi bien sur un jean que sur un pantalon de tailleur.",
    tags: ["ceinture", "cuir"],
    colors: [["Noir", "#1a1a1a"], ["Brun", "#4a3426"]],
    sizes: ["S", "M", "L"],
    createdDaysAgo: 95,
    soldCount: 108,
  },
  {
    slug: "echarpe-en-laine",
    name: "Écharpe en laine",
    reference: "ATL-A-004",
    categoryId: "cat_accessoires",
    gender: "unisex",
    price: 3200,
    description:
      "Écharpe en laine mérinos, frangée aux extrémités. Douce, enveloppante, 190 × 40 cm.",
    tags: ["écharpe", "laine", "hiver"],
    colors: [["Gris", "#8a8a88"], ["Camel", "#b08a5b"], ["Bordeaux", "#6d1f2c"]],
    sizes: ["Unique"],
    createdDaysAgo: 11,
    soldCount: 45,
  },
  /* Cas particuliers pour illustrer l'admin : brouillon non publié et produit archivé. */
  {
    slug: "pull-maille-cotelee",
    name: "Pull en maille côtelée",
    reference: "ATL-F-008",
    categoryId: "cat_hauts",
    gender: "women",
    price: 6200,
    description: "Pull en maille côtelée, col rond et coupe ajustée. Brouillon en cours de préparation.",
    tags: ["pull", "maille"],
    colors: [["Écru", "#ece4d3"], ["Noir", "#1a1a1a"]],
    sizes: ["S", "M", "L"],
    createdDaysAgo: 1,
    soldCount: 0,
    published: false,
  },
  {
    slug: "veste-en-jean-ancienne-collection",
    name: "Veste en jean (ancienne collection)",
    reference: "ATL-H-009",
    categoryId: "cat_vestes",
    gender: "men",
    price: 8900,
    description: "Veste en denim de l'ancienne collection, retirée du catalogue.",
    tags: ["veste", "denim"],
    colors: [["Bleu délavé", "#6f86a6"]],
    sizes: ["M", "L"],
    createdDaysAgo: 260,
    soldCount: 33,
    archived: true,
    published: false,
  },
];

function buildImages(seed: ProductSeed): ProductImage[] {
  const images: ProductImage[] = [];
  let position = 0;
  for (const [color] of seed.colors) {
    const colorSlug = slugify(color);
    for (const n of [1, 2]) {
      images.push({
        id: `img_${seed.slug}_${colorSlug}_${n}`,
        url: `/images/products/${seed.slug}/${colorSlug}-${n}.svg`,
        alt: `${seed.name} — ${color}${n === 2 ? ", vue détail" : ""}`,
        color,
        position: position++,
      });
    }
  }
  return images;
}

let stockCursor = 0;

function buildVariants(seed: ProductSeed, productId: string): ProductVariant[] {
  const variants: ProductVariant[] = [];
  for (const [color, colorCode] of seed.colors) {
    for (const size of seed.sizes) {
      const stock = STOCK_PATTERN[stockCursor++ % STOCK_PATTERN.length] as number;
      variants.push({
        id: `var_${seed.reference}_${slugify(color)}_${slugify(size)}`.toLowerCase(),
        productId,
        sku: buildSku(seed.reference, color, size),
        color,
        colorCode,
        size,
        price: seed.price,
        stock: seed.archived ? 0 : stock,
        alertThreshold: 3,
      });
    }
  }
  return variants;
}

export const productsMock: Product[] = SEEDS.map((seed, index) => {
  const id = `prod_${String(index + 1).padStart(3, "0")}`;
  const createdAt = daysAgo(seed.createdDaysAgo, 9);
  return {
    id,
    reference: seed.reference,
    name: seed.name,
    slug: seed.slug,
    description: seed.description,
    categoryId: seed.categoryId,
    gender: seed.gender,
    tags: seed.tags,
    price: seed.price,
    costPrice: Math.round((seed.price * (seed.costRatio ?? 0.48)) / 50) * 50,
    compareAtPrice: seed.compareAtPrice,
    images: buildImages(seed),
    variants: buildVariants(seed, id),
    soldCount: seed.soldCount,
    isFeatured: seed.featured ?? false,
    isPublished: seed.published ?? true,
    isArchived: seed.archived ?? false,
    createdAt,
    updatedAt: createdAt,
  };
});
