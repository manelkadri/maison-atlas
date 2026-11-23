"use client";

import { useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { slugify } from "@fashion/shared";
import { categoryFormSchema, type CategoryFormValues } from "@fashion/validators";
import { ImagePlus, Loader2, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { ProductThumb } from "@/components/admin/products/product-thumb";
import { NumberInput } from "@/components/admin/products/form/number-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateCategory, useUpdateCategory } from "@/features/categories/hooks";
import { isApiMode } from "@/lib/api-config";
import { validateImageReference } from "@/lib/image-utils";
import { getErrorMessage, uploadService } from "@/services";
import type { Category } from "@/types/product.types";

const NO_PARENT = "__none__";

export type CategoryDialogState = { mode: "create"; parentId: string | null } | { mode: "edit"; category: Category };

type Props = {
  state: CategoryDialogState;
  categories: Category[];
  onClose: () => void;
};

/** Création / modification d'une catégorie (monté uniquement quand la boîte de dialogue est ouverte). */
export function CategoryFormDialog({ state, categories, onClose }: Props) {
  const editing = state.mode === "edit" ? state.category : undefined;
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [slugManual, setSlugManual] = useState(!!editing);

  const hasChildren = !!editing && categories.some((c) => c.parentId === editing.id);
  const isCollection = editing?.kind === "collection";
  const nextOrder = Math.max(0, ...categories.map((c) => c.displayOrder)) + 1;
  const parentOptions = categories.filter((c) => !c.parentId && c.kind === "category" && c.id !== editing?.id && (!c.isArchived || c.id === editing?.parentId));

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: editing
      ? {
          name: editing.name,
          slug: editing.slug,
          description: editing.description,
          imageUrl: editing.imageUrl,
          parentId: editing.parentId,
          displayOrder: editing.displayOrder,
        }
      : { name: "", slug: "", description: "", imageUrl: "", parentId: state.mode === "create" ? state.parentId : null, displayOrder: nextOrder },
    mode: "onTouched",
  });
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    getValues,
    formState: { errors, isSubmitting, touchedFields, isSubmitted },
  } = form;
  const imageUrl = useWatch({ control, name: "imageUrl" });
  const nameReg = register("name");
  const slugReg = register("slug");

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      setValue("imageUrl", (await uploadService.uploadImage(file)).url, { shouldDirty: true });
    } catch (err) {
      toast.error(getErrorMessage(err, "Impossible de traiter cette image."));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    const imageProblem = values.imageUrl.trim() ? validateImageReference(values.imageUrl) : null;
    if (imageProblem) return setError("imageUrl", { message: imageProblem });
    if (categories.some((c) => c.slug === values.slug && c.id !== editing?.id)) {
      return setError("slug", { type: "server", message: `Le slug « ${values.slug} » est déjà utilisé.` });
    }
    try {
      if (editing) {
        await updateCategory.mutateAsync({
          id: editing.id,
          data: { name: values.name.trim(), slug: values.slug, description: values.description.trim(), imageUrl: values.imageUrl.trim(), parentId: values.parentId, displayOrder: values.displayOrder },
        });
        toast.success(`Catégorie « ${values.name.trim()} » mise à jour.`);
      } else {
        await createCategory.mutateAsync({
          name: values.name.trim(),
          slug: values.slug,
          description: values.description.trim(),
          imageUrl: values.imageUrl.trim(),
          kind: "category",
          parentId: values.parentId,
          displayOrder: values.displayOrder,
        });
        toast.success(`Catégorie « ${values.name.trim()} » créée.`);
      }
      onClose();
    } catch (err) {
      const message = getErrorMessage(err);
      if (/slug/i.test(message)) setError("slug", { type: "server", message });
      toast.error(message);
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Modifier « ${editing.name} »` : state.mode === "create" && state.parentId ? "Nouvelle sous-catégorie" : "Nouvelle catégorie"}</DialogTitle>
          <DialogDescription>
            {isCollection
              ? "Collection système : regroupement dynamique sans produits rattachés directement."
              : "Les catégories organisent la boutique : une catégorie racine peut contenir des sous-catégories."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label="Formulaire de catégorie">
          <FormField label="Nom" htmlFor="category-name" error={errors.name?.message} required>
            <Input
              id="category-name"
              autoComplete="off"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "category-name-error" : undefined}
              {...nameReg}
              onChange={(e) => {
                void nameReg.onChange(e);
                if (!slugManual) setValue("slug", slugify(e.target.value), { shouldDirty: true, shouldValidate: !!touchedFields.slug || isSubmitted });
              }}
            />
          </FormField>

          <FormField label="Slug" htmlFor="category-slug" error={errors.slug?.message} hint={slugManual ? "Modifié manuellement." : "Généré automatiquement depuis le nom."} required>
            <div className="flex gap-2">
              <Input
                id="category-slug"
                autoComplete="off"
                aria-invalid={!!errors.slug}
                aria-describedby={errors.slug ? "category-slug-error" : undefined}
                {...slugReg}
                onChange={(e) => {
                  void slugReg.onChange(e);
                  setSlugManual(e.target.value !== "");
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Régénérer le slug depuis le nom"
                title="Régénérer depuis le nom"
                onClick={() => {
                  setValue("slug", slugify(getValues("name")), { shouldDirty: true, shouldValidate: true });
                  setSlugManual(false);
                }}
              >
                <Wand2 aria-hidden />
              </Button>
            </div>
          </FormField>

          <FormField label="Description" htmlFor="category-description" error={errors.description?.message} hint="300 caractères maximum.">
            <Textarea id="category-description" rows={3} maxLength={300} aria-invalid={!!errors.description} {...register("description")} />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Catégorie parente"
              htmlFor="category-parent"
              error={errors.parentId?.message}
              hint={hasChildren ? "Cette catégorie a des sous-catégories : elle doit rester une racine." : isCollection ? "Une collection reste à la racine." : undefined}
            >
              <Controller
                control={control}
                name="parentId"
                render={({ field }) => (
                  <Select value={field.value ?? NO_PARENT} onValueChange={(v) => field.onChange(v === NO_PARENT ? null : v)} disabled={hasChildren || isCollection}>
                    <SelectTrigger id="category-parent" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PARENT}>Aucune (catégorie racine)</SelectItem>
                      {parentOptions.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                          {c.isArchived ? " (archivée)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField label="Ordre d'affichage" htmlFor="category-order" error={errors.displayOrder?.message} hint="Les plus petits nombres apparaissent en premier.">
              <Controller
                control={control}
                name="displayOrder"
                render={({ field }) => (
                  <NumberInput id="category-order" whenEmpty="zero" value={field.value} onValueChange={(v) => field.onChange(v ?? 0)} onBlur={field.onBlur} aria-invalid={!!errors.displayOrder} />
                )}
              />
            </FormField>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Image</p>
            <div className="flex items-start gap-3">
              <ProductThumb src={imageUrl.trim() || undefined} alt="Aperçu de l'image de la catégorie" className="size-20" sizes="96px" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    tabIndex={-1}
                    aria-label="Sélectionner un fichier image"
                    onChange={(e) => void onFile(e.target.files?.[0])}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />}
                    Choisir un fichier
                  </Button>
                  {imageUrl && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setValue("imageUrl", "", { shouldDirty: true })} className="text-destructive hover:text-destructive">
                      <Trash2 aria-hidden /> Retirer
                    </Button>
                  )}
                </div>
                <Input
                  id="category-image"
                  placeholder="Ou une URL / un chemin /images/categories/…"
                  aria-label="URL ou chemin de l'image"
                  aria-invalid={!!errors.imageUrl}
                  value={imageUrl.startsWith("data:") ? "" : imageUrl}
                  onChange={(e) => setValue("imageUrl", e.target.value, { shouldDirty: true })}
                />
                {errors.imageUrl?.message && (
                  <p role="alert" className="text-destructive text-xs">
                    {errors.imageUrl.message}
                  </p>
                )}
                <p className="text-muted-foreground text-xs">
                  {isApiMode()
                    ? "L'image est envoyée au serveur de la boutique, qui l'héberge."
                    : "Téléversement simulé (image compressée, conservée dans le navigateur)."}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
              {editing ? "Enregistrer" : "Créer la catégorie"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
