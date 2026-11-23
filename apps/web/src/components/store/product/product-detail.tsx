"use client";

import { isNewProduct } from "@fashion/shared";
import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { FavoriteButton } from "@/components/store/favorite-button";
import { ProductCard } from "@/components/store/product-card";
import { useCategories } from "@/features/categories/hooks";
import { useProductBySlug, useRelatedProducts } from "@/features/products/hooks";
import {
  buildCartItem,
  clampQuantity,
  getColorOptions,
  getImagesForColor,
  getSizeChoices,
  getVariantAvailability,
  pickInitialColor,
  resolveSelectedVariant,
  resolveSizeOnColorChange,
  type AvailabilityKind,
} from "@/features/products/variant-selection";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/stores/cart.store";
import type { Product } from "@/types/product.types";
import { DeliveryInfo } from "./delivery-info";
import { ProductGallery } from "./product-gallery";
import { ProductDetailSkeleton, ProductNotFound } from "./product-states";
import { isOneSizeOnly } from "./size-guide-data";
import { SizeGuideDialog } from "./size-guide-dialog";
import { StickyBuyBar } from "./sticky-buy-bar";
import { ColorPicker, SizePicker } from "./variant-selector";

type ProductDetailProps = {
  slug: string;
  /** Produit connu du serveur, ou null. */
  initialProduct: Product | null;
  initialRelated?: Product[];
};

/**
 * Fiche produit (client).
 *
 * LIMITATION PHASE 1 : un produit créé depuis l'admin n'existe que dans le localStorage du navigateur ;
 * le serveur ne le connaît pas. Si `initialProduct` est null, on interroge donc la base locale côté navigateur
 * (`useProductBySlug`) et on n'affiche « Produit introuvable » (noindex) qu'une fois ce chargement terminé.
 * Avec une vraie API (phase 2), le serveur tranchera et la page pourra appeler `notFound()`.
 */
export function ProductDetail({ slug, initialProduct, initialRelated }: ProductDetailProps) {
  const hydrated = useHydrated();
  const query = useProductBySlug(slug, initialProduct ?? undefined);
  const product = query.data;

  if (product) return <ProductView key={product.id} product={product} initialRelated={initialRelated} />;
  if (query.isError) {
    return (
      <div className="container-store py-16" role="alert">
        <p className="text-center text-sm">Impossible de charger ce produit pour le moment.</p>
        <div className="mt-4 text-center">
          <Button type="button" variant="outline" onClick={() => void query.refetch()}>
            Réessayer
          </Button>
        </div>
      </div>
    );
  }
  if (!hydrated || query.isPending || query.isFetching) return <ProductDetailSkeleton />;
  return <ProductNotFound />;
}

const AVAILABILITY_TONE: Record<AvailabilityKind, string> = {
  no_size: "bg-muted-foreground",
  available: "bg-success",
  low: "bg-warning",
  out_of_stock: "bg-destructive",
};

function ProductView({ product, initialRelated }: { product: Product; initialRelated?: Product[] }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const addItem = useCartStore((s) => s.addItem);

  const [color, setColor] = useState<string | undefined>(() => pickInitialColor(product));
  const [size, setSize] = useState<string | undefined>(undefined);
  const [quantity, setQuantity] = useState(1);
  const [highlightSize, setHighlightSize] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);

  const categories = useCategories().data;
  const category = categories?.find((c) => c.id === product.categoryId);
  const related = useRelatedProducts(product.id, 4, initialRelated?.length ? initialRelated : undefined).data ?? [];

  // Tout est dérivé de (couleur, taille) : si le catalogue change sous nos pieds, on retombe sur un état valide.
  const colorOptions = useMemo(() => getColorOptions(product), [product]);
  const activeColor = colorOptions.some((c) => c.name === color) ? color : pickInitialColor(product);
  const sizeChoices = useMemo(() => getSizeChoices(product, activeColor), [product, activeColor]);
  const variant = resolveSelectedVariant(product, activeColor, size);
  const availability = getVariantAvailability(variant);
  const qty = clampQuantity(quantity, variant);
  const images = useMemo(() => getImagesForColor(product, activeColor), [product, activeColor]);

  const inCart = useCartStore((s) => s.items.find((i) => i.variantId === variant?.id)?.quantity ?? 0);
  const alreadyInCart = hydrated ? inCart : 0;

  const price = variant?.price ?? product.price;
  const compareAt = price === product.price ? product.compareAtPrice : undefined;
  const oneSize = isOneSizeOnly(sizeChoices.map((s) => s.size));

  const selectColor = (name: string) => {
    setColor(name);
    // Conserve la taille uniquement si la combinaison existe et est en stock.
    const nextSize = resolveSizeOnColorChange(product, name, size);
    setSize(nextSize);
    setQuantity((q) => clampQuantity(q, resolveSelectedVariant(product, name, nextSize)));
  };

  const selectSize = (nextSize: string) => {
    setSize(nextSize);
    setQuantity((q) => clampQuantity(q, resolveSelectedVariant(product, activeColor, nextSize)));
  };

  const focusSizes = () => {
    document.getElementById("product-sizes")?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightSize(true);
    window.setTimeout(() => setHighlightSize(false), 2200);
  };

  const addToCart = () => {
    if (!variant || !availability.canAdd) {
      focusSizes();
      return;
    }
    const added = addItem(buildCartItem(product, variant), qty);
    const label = `${variant.color}, ${variant.size}`;
    if (added === 0) {
      toast.warning("Stock maximum déjà atteint", {
        description: `Votre panier contient déjà tout le stock disponible de cet article (${label}).`,
        action: { label: "Voir le panier", onClick: () => router.push("/cart") },
      });
      return;
    }
    if (added < qty) {
      toast.warning(`Seulement ${added} ajouté${added > 1 ? "s" : ""} au panier`, {
        description: `Stock limité pour ${product.name} (${label}).`,
        action: { label: "Voir le panier", onClick: () => router.push("/cart") },
      });
      return;
    }
    toast.success("Ajouté au panier", {
      description: `${product.name} · ${label}${added > 1 ? ` × ${added}` : ""}`,
      action: { label: "Voir le panier", onClick: () => router.push("/cart") },
    });
  };

  const shortDescription = product.description.split(/(?<=[.!?])\s/)[0] ?? product.description;
  const paragraphs = product.description.split(/\n+/).filter(Boolean);

  return (
    <>
      <div className="container-store py-6 md:py-10">
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/">Accueil</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/shop">Boutique</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {category && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href={`/shop?category=${encodeURIComponent(category.slug)}`}>{category.name}</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </>
            )}
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="max-w-[12rem] truncate sm:max-w-none">{product.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="reveal grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-14 xl:gap-20">
          {/* key = couleur : la galerie repart de la première photo de la couleur choisie */}
          <ProductGallery key={activeColor ?? "all"} images={images} productName={product.name} className="lg:sticky lg:top-24" />

          <div className="min-w-0 space-y-7">
            <header className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {category && (
                  <Link
                    href={`/shop?category=${encodeURIComponent(category.slug)}`}
                    className="eyebrow hover:text-foreground underline-offset-4 hover:underline"
                  >
                    {category.name}
                  </Link>
                )}
                {isNewProduct(product) && <span className="bg-foreground text-background rounded-sm px-2 py-0.5 text-[0.7rem] font-medium tracking-wide uppercase">Nouveau</span>}
              </div>
              <h1 className="font-display text-3xl leading-tight md:text-4xl">{product.name}</h1>
              <p className="text-muted-foreground text-sm">Réf. {product.reference}</p>
              <Price price={price} compareAtPrice={compareAt} size="lg" showDiscount />
              <p className="text-muted-foreground max-w-prose text-[0.95rem] leading-relaxed">{shortDescription}</p>
            </header>

            <div className="space-y-6">
              <ColorPicker options={colorOptions} value={activeColor} onChange={selectColor} />
              <SizePicker
                id="product-sizes"
                choices={sizeChoices}
                value={variant ? size : undefined}
                onChange={selectSize}
                invalid={highlightSize}
                guide={oneSize ? undefined : <SizeGuideDialog />}
              />
            </div>

            <div ref={ctaRef} className="space-y-4">
              <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm font-medium">
                <span className={cn("size-2 rounded-full", AVAILABILITY_TONE[availability.kind])} aria-hidden />
                {availability.label}
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <QuantityStepper
                  value={qty}
                  onChange={(v) => setQuantity(clampQuantity(v, variant))}
                  max={Math.max(availability.maxQuantity, 1)}
                  className={cn(!availability.canAdd && "pointer-events-none opacity-50")}
                />
                {alreadyInCart > 0 && variant && (
                  <p className="text-muted-foreground text-xs">
                    Déjà {alreadyInCart} dans votre panier
                  </p>
                )}
              </div>

              <div className="flex items-stretch gap-3">
                <Button
                  type="button"
                  size="lg"
                  className="h-12 flex-1 text-base"
                  disabled={!availability.canAdd}
                  aria-describedby="add-to-cart-hint"
                  onClick={addToCart}
                >
                  <ShoppingBag aria-hidden />
                  Ajouter au panier
                </Button>
                <FavoriteButton productId={product.id} productName={product.name} variant="inline" className="size-12" />
              </div>

              <p id="add-to-cart-hint" className="text-muted-foreground text-xs leading-relaxed">
                {availability.kind === "no_size"
                  ? "Sélectionnez une taille pour pouvoir ajouter cet article au panier."
                  : availability.kind === "out_of_stock"
                    ? "Cette combinaison est épuisée. Choisissez une autre taille ou une autre couleur."
                    : "Paiement à la livraison. Frais de livraison calculés à l'étape suivante."}
              </p>
            </div>

            <Accordion type="multiple" defaultValue={["description"]} className="border-t">
              <AccordionItem value="description">
                <AccordionTrigger>Description détaillée</AccordionTrigger>
                <AccordionContent className="space-y-3 text-sm leading-relaxed">
                  {paragraphs.map((p, i) => (
                    <p key={i} className="text-muted-foreground">
                      {p}
                    </p>
                  ))}
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 pt-1 text-sm">
                    <dt className="text-muted-foreground">Référence</dt>
                    <dd>{product.reference}</dd>
                    {category && (
                      <>
                        <dt className="text-muted-foreground">Catégorie</dt>
                        <dd>
                          <Link href={`/shop?category=${encodeURIComponent(category.slug)}`} className="underline underline-offset-4">
                            {category.name}
                          </Link>
                        </dd>
                      </>
                    )}
                  </dl>
                </AccordionContent>
              </AccordionItem>
              {!oneSize && (
                <AccordionItem value="sizes">
                  <AccordionTrigger>Guide des tailles</AccordionTrigger>
                  <AccordionContent className="space-y-3 text-sm">
                    <p className="text-muted-foreground leading-relaxed">
                      Comparez vos mensurations (poitrine, taille, hanches) avec notre tableau de correspondance pour choisir la taille idéale.
                    </p>
                    <SizeGuideDialog />
                  </AccordionContent>
                </AccordionItem>
              )}
              <AccordionItem value="delivery">
                <AccordionTrigger>Livraison &amp; retours</AccordionTrigger>
                <AccordionContent>
                  <DeliveryInfo />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>

        {related.length > 0 && (
          <section aria-labelledby="related-title" className="mt-16 md:mt-24">
            <h2 id="related-title" className="font-display mb-6 text-2xl md:text-3xl">
              Vous aimerez aussi
            </h2>
            <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:gap-x-5 lg:grid-cols-4">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}

        {/* Réserve la hauteur de la barre d'achat mobile pour ne rien masquer. */}
        <div className="h-20 lg:hidden" aria-hidden />
      </div>

      <StickyBuyBar
        anchorRef={ctaRef}
        price={price}
        compareAtPrice={compareAt}
        actionLabel={availability.canAdd ? "Ajouter au panier" : availability.kind === "out_of_stock" ? "Choisir une autre taille" : "Choisir une taille"}
        onAction={availability.canAdd ? addToCart : focusSizes}
      />
    </>
  );
}
