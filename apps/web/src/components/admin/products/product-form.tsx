"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productFormSchema, type ProductFormValues } from "@fashion/validators";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { useBreadcrumbLabel } from "@/components/admin/shell/breadcrumbs";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ADMIN_ROOT } from "@/config/admin-nav";
import { useCategories } from "@/features/categories/hooks";
import { getProductCategoryOptions } from "@/features/categories/tree";
import { emptyProductFormValues, formValuesToCreateInput, productToFormValues } from "@/features/products/form-mapper";
import { useCreateProduct, useProducts, useUpdateProduct } from "@/features/products/hooks";
import { findSkuIssues } from "@/features/products/variants";
import { useSettings } from "@/features/settings/hooks";
import { getErrorMessage } from "@/services";
import type { Product } from "@/types/product.types";
import { FormNav } from "./form/form-nav";
import { FORM_SECTIONS, type FormSectionId } from "./form/form-section";
import { SectionImages } from "./form/section-images";
import { SectionInfo } from "./form/section-info";
import { SectionPricing } from "./form/section-pricing";
import { SectionPublication } from "./form/section-publication";
import { SectionVariants } from "./form/section-variants";

const LIST_HREF = `${ADMIN_ROOT}/products`;

function scrollToSection(id: FormSectionId) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

type ProductFormProps = { mode: "create" } | { mode: "edit"; product: Product };

/** Formulaire produit (création / modification) organisé en sections ancrées. */
export function ProductForm(props: ProductFormProps) {
  const product = props.mode === "edit" ? props.product : undefined;
  const isEdit = props.mode === "edit";
  const router = useRouter();

  const categories = useCategories(true);
  const products = useProducts();
  const settings = useSettings();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const [defaults] = useState<ProductFormValues>(() => (product ? productToFormValues(product) : emptyProductFormValues(3)));
  const form = useForm<ProductFormValues>({ resolver: zodResolver(productFormSchema), defaultValues: defaults, mode: "onTouched" });
  const {
    handleSubmit,
    setError,
    setValue,
    getValues,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = form;

  const [slugManual, setSlugManual] = useState(isEdit);
  const [confirmCancel, setConfirmCancel] = useState(false);

  /* Seuil d'alerte par défaut issu des paramètres (création uniquement, tant que rien n'est saisi). */
  const thresholdApplied = useRef(false);
  useEffect(() => {
    if (isEdit || thresholdApplied.current || !settings.data) return;
    thresholdApplied.current = true;
    if (getValues("variants").length === 0) setValue("defaultAlertThreshold", settings.data.defaultAlertThreshold);
  }, [isEdit, settings.data, getValues, setValue]);

  /* Prévient avant de quitter l'onglet avec des modifications non enregistrées. */
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  /* Unicité contre les AUTRES produits du catalogue. */
  const others = useMemo(() => (products.data ?? []).filter((p) => p.id !== product?.id), [products.data, product?.id]);
  const otherSkus = useMemo(() => others.flatMap((p) => p.variants.map((v) => v.sku)), [others]);
  const slug = useWatch({ control: form.control, name: "slug" });
  const slugTaken = useMemo(() => !!slug && others.some((p) => p.slug === slug), [others, slug]);

  const categoryOptions = useMemo(() => getProductCategoryOptions(categories.data ?? [], product?.categoryId), [categories.data, product?.categoryId]);

  const sectionsWithErrors = useMemo(() => {
    const keys = new Set(Object.keys(errors));
    return new Set<FormSectionId>(FORM_SECTIONS.filter((s) => s.fields.some((f) => keys.has(f))).map((s) => s.id));
  }, [errors]);

  const onInvalid = (invalid: FieldErrors<ProductFormValues>) => {
    const keys = new Set(Object.keys(invalid));
    const first = FORM_SECTIONS.find((s) => s.fields.some((f) => keys.has(f)));
    toast.error("Le formulaire contient des erreurs.", { description: "Corrigez les champs signalés en rouge, puis réessayez." });
    if (first) scrollToSection(first.id);
  };

  const onSubmit = handleSubmit(async (values) => {
    if (others.some((p) => p.slug === values.slug)) {
      setError("slug", { type: "server", message: "Ce slug est déjà utilisé par un autre produit." });
      toast.error("Ce slug est déjà utilisé par un autre produit.");
      scrollToSection("section-info");
      return;
    }
    if (findSkuIssues(values.variants, otherSkus).size > 0) {
      setError("variants", { type: "server", message: "Corrigez les SKU en doublon ou déjà utilisés avant d'enregistrer." });
      toast.error("Certains SKU sont en doublon ou déjà utilisés.");
      scrollToSection("section-variants");
      return;
    }

    const input = formValuesToCreateInput(values);
    try {
      if (product) await updateProduct.mutateAsync({ id: product.id, data: input });
      else await createProduct.mutateAsync(input);
      reset(values); // plus de modifications en attente : pas d'alerte à la navigation
      toast.success(product ? `« ${input.name} » a été mis à jour.` : `« ${input.name} » a été créé${input.isPublished ? " et publié" : " en brouillon"}.`);
      router.push(LIST_HREF);
    } catch (err) {
      const message = getErrorMessage(err);
      if (/slug/i.test(message)) {
        setError("slug", { type: "server", message });
        scrollToSection("section-info");
      } else if (/sku/i.test(message)) {
        setError("variants", { type: "server", message });
        scrollToSection("section-variants");
      }
      toast.error(message);
    }
  }, onInvalid);

  const onCancel = () => {
    if (isDirty) setConfirmCancel(true);
    else router.push(LIST_HREF);
  };

  return (
    <>
      <PageHeader
        title={isEdit ? "Modifier le produit" : "Nouveau produit"}
        description={isEdit ? product?.name : "Renseignez la fiche, les prix, les images et les variantes."}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={LIST_HREF}>
              <ArrowLeft aria-hidden /> Retour aux produits
            </Link>
          </Button>
        }
      />

      <form onSubmit={onSubmit} noValidate aria-label={isEdit ? "Modifier le produit" : "Créer un produit"}>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <div className="lg:self-start">
            <FormNav sectionsWithErrors={sectionsWithErrors} />
          </div>

          <div className="min-w-0 space-y-6">
            <SectionInfo
              form={form}
              categoryOptions={categoryOptions}
              categoriesLoading={categories.isPending}
              slugManual={slugManual}
              onSlugManualChange={setSlugManual}
              slugTaken={slugTaken}
              hasError={sectionsWithErrors.has("section-info")}
            />
            <SectionPricing form={form} hasError={sectionsWithErrors.has("section-pricing")} />
            <SectionImages form={form} hasError={sectionsWithErrors.has("section-images")} />
            <SectionVariants form={form} otherSkus={otherSkus} isEdit={isEdit} hasError={sectionsWithErrors.has("section-variants")} />
            <SectionPublication form={form} hasError={sectionsWithErrors.has("section-publication")} />
          </div>
        </div>

        <div className="bg-card/95 sticky bottom-0 z-20 -mx-4 mt-6 flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {isDirty ? <span className="text-warning font-medium">Modifications non enregistrées</span> : isEdit ? "Aucune modification" : "Brouillon non enregistré"}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
              {isSubmitting ? "Enregistrement…" : isEdit ? "Enregistrer les modifications" : "Enregistrer le produit"}
            </Button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Abandonner les modifications ?"
        variant="destructive"
        confirmLabel="Abandonner"
        cancelLabel="Continuer l'édition"
        description={<p>Les changements non enregistrés seront perdus.</p>}
        onConfirm={() => {
          setConfirmCancel(false);
          reset(defaults);
          router.push(LIST_HREF);
        }}
      />
    </>
  );
}

/** Page de modification : libellé de fil d'Ariane + formulaire. */
export function ProductFormBreadcrumb({ product }: { product: Product }) {
  useBreadcrumbLabel(`${ADMIN_ROOT}/products/${product.id}`, product.name);
  return null;
}
