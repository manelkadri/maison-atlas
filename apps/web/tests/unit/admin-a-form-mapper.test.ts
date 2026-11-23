import { describe, expect, it } from "vitest";
import { productFormSchema } from "@fashion/validators";
import {
  computeMargin,
  emptyProductFormValues,
  formValuesToCreateInput,
  getEffectivePrice,
  productToFormValues,
} from "@/features/products/form-mapper";
import { makeProduct, makeVariant } from "./admin-a-fixtures";

describe("form-mapper — prix et promotion", () => {
  it("promo → price = prix promo, compareAtPrice = ancien prix", () => {
    const base = productToFormValues(makeProduct());
    const input = formValuesToCreateInput({ ...base, regularPrice: 6000, promoPrice: 4500 });
    expect(input.price).toBe(4500);
    expect(input.compareAtPrice).toBe(6000);
  });

  it("sans promo : price = prix de vente et compareAtPrice est explicitement absent (efface l'ancien prix)", () => {
    const base = productToFormValues(makeProduct({ price: 4000, compareAtPrice: 5000 }));
    const input = formValuesToCreateInput({ ...base, regularPrice: 4000, promoPrice: undefined });
    expect(input.price).toBe(4000);
    expect(input.compareAtPrice).toBeUndefined();
    expect("compareAtPrice" in input).toBe(true);
  });

  it("un prix promo supérieur ou égal au prix de vente est ignoré", () => {
    expect(getEffectivePrice(5000, 5000)).toBe(5000);
    expect(getEffectivePrice(5000, 7000)).toBe(5000);
    expect(getEffectivePrice(5000, 0)).toBe(5000);
    expect(getEffectivePrice(5000, 3500)).toBe(3500);
  });

  it("marge brute en DZD et en %, détection de la vente à perte", () => {
    expect(computeMargin(5000, 2000)).toEqual({ amount: 3000, percent: 60, isLoss: false });
    expect(computeMargin(1000, 1500)).toMatchObject({ amount: -500, isLoss: true });
    expect(computeMargin(0, 0).percent).toBeNull();
  });
});

describe("form-mapper — aller-retour", () => {
  it("produit → formulaire → entrée : conserve les champs métier", () => {
    const product = makeProduct({ price: 3500, compareAtPrice: 5000, tags: ["a", "b"], isFeatured: true });
    const values = productToFormValues(product);
    expect(values.regularPrice).toBe(5000);
    expect(values.promoPrice).toBe(3500);
    expect(values.colors).toEqual([{ name: "Noir", code: "#1a1a1a" }]);
    expect(values.sizes).toEqual(["M", "L"]);

    const input = formValuesToCreateInput(values);
    expect(input).toMatchObject({
      name: product.name,
      slug: product.slug,
      reference: product.reference,
      categoryId: product.categoryId,
      price: 3500,
      compareAtPrice: 5000,
      costPrice: product.costPrice,
      isFeatured: true,
      isPublished: true,
    });
    expect(input.variants).toHaveLength(2);
    expect(input.variants[0]).toMatchObject({ id: product.variants[0]?.id, sku: product.variants[0]?.sku, stock: 10 });
  });

  it("un produit sans promo revient sans prix promotionnel", () => {
    const values = productToFormValues(makeProduct({ price: 4500 }));
    expect(values.regularPrice).toBe(4500);
    expect(values.promoPrice).toBeUndefined();
  });

  it("les valeurs issues d'un produit existant passent la validation du schéma", () => {
    const parsed = productFormSchema.safeParse(productToFormValues(makeProduct()));
    expect(parsed.success).toBe(true);
  });

  it("un formulaire vide est refusé (champs obligatoires)", () => {
    const parsed = productFormSchema.safeParse(emptyProductFormValues());
    expect(parsed.success).toBe(false);
  });

  it("réordonne les positions des images et renseigne un alt par défaut", () => {
    const values = productToFormValues(makeProduct());
    const input = formValuesToCreateInput({
      ...values,
      images: [
        { id: "b", url: "/images/b.svg", alt: "", position: 5 },
        { id: "a", url: "/images/a.svg", alt: "Face", position: 9, color: "Noir" },
      ],
    });
    expect(input.images.map((i) => i.position)).toEqual([0, 1]);
    expect(input.images[0]?.alt).toBe(values.name);
    expect(input.images[1]?.color).toBe("Noir");
  });

  it("les variantes sans id restent sans id (nouvelles variantes)", () => {
    const values = productToFormValues(makeProduct({ variants: [makeVariant({ color: "Noir", size: "M" })] }));
    const first = values.variants[0];
    if (!first) throw new Error("variante attendue");
    const { id: _id, ...withoutId } = first;
    const input = formValuesToCreateInput({ ...values, variants: [withoutId] });
    expect(input.variants[0] && "id" in input.variants[0]).toBe(false);
  });
});
