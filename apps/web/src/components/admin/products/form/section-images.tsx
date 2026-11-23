"use client";

import { useRef, useState, type DragEvent } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import type { ProductFormValues } from "@fashion/validators";
import { ArrowDown, ArrowUp, ImagePlus, Info, Link2, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isApiMode } from "@/lib/api-config";
import { validateImageReference } from "@/lib/image-utils";
import { cn } from "@/lib/utils";
import { uploadService } from "@/services";
import { ProductThumb } from "../product-thumb";
import { FormSection } from "./form-section";

type ImageValue = ProductFormValues["images"][number];

const MAX_IMAGES = 8;
const ALL_COLORS = "__all__";

function newImageId(): string {
  return `img_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function SectionImages({ form, hasError }: { form: UseFormReturn<ProductFormValues>; hasError: boolean }) {
  const {
    control,
    setValue,
    getValues,
    formState: { errors, isSubmitted },
  } = form;
  const images = useWatch({ control, name: "images" });
  const colors = useWatch({ control, name: "colors" });
  const fileInput = useRef<HTMLInputElement>(null);
  const apiMode = isApiMode();
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [urlError, setUrlError] = useState<string | undefined>();

  const save = (next: ImageValue[]) =>
    setValue(
      "images",
      next.map((img, position) => ({ ...img, position })),
      { shouldDirty: true, shouldValidate: isSubmitted },
    );

  const addImages = (newOnes: ImageValue[]) => {
    const current = getValues("images");
    const room = MAX_IMAGES - current.length;
    if (newOnes.length > room) toast.warning(`Maximum ${MAX_IMAGES} images par produit : ${Math.max(0, room)} ajoutée(s).`);
    save([...current, ...newOnes.slice(0, Math.max(0, room))]);
  };

  const handleFiles = async (list: FileList | File[]) => {
    const files = Array.from(list);
    if (files.length === 0) return;
    setProcessing(true);
    const name = getValues("name");
    const results = await Promise.allSettled(files.map(async (f) => (await uploadService.uploadImage(f)).url));
    const added: ImageValue[] = [];
    results.forEach((r, i) => {
      const file = files[i];
      if (r.status === "fulfilled") added.push({ id: newImageId(), url: r.value, alt: name.trim(), position: 0 });
      else toast.error(`${file?.name ?? "Fichier"} : ${r.reason instanceof Error ? r.reason.message : "échec du traitement."}`);
    });
    if (added.length) {
      addImages(added);
      toast.success(`${added.length} image${added.length > 1 ? "s" : ""} ajoutée${added.length > 1 ? "s" : ""}.`);
    }
    setProcessing(false);
    if (fileInput.current) fileInput.current.value = "";
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    void handleFiles(e.dataTransfer.files);
  };

  const addByUrl = () => {
    const problem = validateImageReference(urlDraft);
    setUrlError(problem ?? undefined);
    if (problem) return;
    addImages([{ id: newImageId(), url: urlDraft.trim(), alt: getValues("name").trim(), position: 0 }]);
    setUrlDraft("");
  };

  const updateImage = (index: number, patch: Partial<ImageValue>) => save(images.map((img, i) => (i === index ? { ...img, ...patch } : img)));
  const setColor = (index: number, color: string) => {
    const target = images[index];
    if (!target) return;
    const { color: _old, ...rest } = target;
    save(images.map((img, i) => (i === index ? (color === ALL_COLORS ? rest : { ...rest, color }) : img)));
  };
  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    const [item] = next.splice(index, 1);
    if (item) next.splice(target, 0, item);
    save(next);
  };
  const remove = (index: number) => save(images.filter((_, i) => i !== index));

  return (
    <FormSection
      id="section-images"
      title="Images"
      description="La première image est l'image principale. Vous pouvez en associer à une couleur."
      hasError={hasError}
    >
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn("flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors", dragging ? "border-brand bg-brand-soft/40" : "border-input")}
      >
        <div className="bg-secondary flex size-11 items-center justify-center rounded-full">
          {processing ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ImagePlus className="text-muted-foreground size-5" aria-hidden />}
        </div>
        <p className="text-sm font-medium">{processing ? "Traitement des images…" : "Glissez vos images ici"}</p>
        <p className="text-muted-foreground text-xs">
          JPEG, PNG ou WebP · 5 Mo maximum par fichier{apiMode ? "" : " · redimensionnées à 900 px"}
        </p>
        <input
          ref={fileInput}
          id="product-images-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-label="Sélectionner des fichiers image"
          onChange={(e) => e.target.files && void handleFiles(e.target.files)}
        />
        <Button type="button" variant="outline" onClick={() => fileInput.current?.click()} disabled={processing || images.length >= MAX_IMAGES}>
          <Upload aria-hidden /> Choisir des fichiers
        </Button>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="product-image-url" className="text-sm font-medium">
          Ou ajouter par URL / chemin
        </label>
        <div className="flex gap-2">
          <Input
            id="product-image-url"
            value={urlDraft}
            onChange={(e) => {
              setUrlDraft(e.target.value);
              setUrlError(undefined);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addByUrl();
              }
            }}
            placeholder="https://… ou /images/products/mon-produit/noir-1.svg"
            aria-invalid={!!urlError}
            aria-describedby={urlError ? "product-image-url-error" : undefined}
          />
          <Button type="button" variant="outline" onClick={addByUrl} disabled={images.length >= MAX_IMAGES}>
            <Link2 aria-hidden /> Ajouter
          </Button>
        </div>
        {urlError && (
          <p id="product-image-url-error" role="alert" className="text-destructive text-xs">
            {urlError}
          </p>
        )}
      </div>

      <p className="text-muted-foreground flex items-start gap-2 text-xs">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {apiMode
          ? "Les images sont envoyées au serveur de la boutique, qui les héberge."
          : "Téléversement simulé : les images sont compressées et conservées dans votre navigateur. L'hébergement sur le serveur sera branché avec l'API."}
      </p>

      {errors.images?.message && (
        <p role="alert" className="text-destructive text-sm">
          {errors.images.message}
        </p>
      )}

      {images.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2" aria-label="Images du produit">
          {images.map((img, index) => (
            <li key={img.id} className="flex gap-3 rounded-md border p-3">
              <div className="relative">
                <ProductThumb src={img.url} alt={img.alt || `Image ${index + 1}`} className="size-20" sizes="96px" />
                {index === 0 && <span className="bg-primary text-primary-foreground absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[0.65rem] font-medium">Principale</span>}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <Input
                  value={img.alt}
                  onChange={(e) => updateImage(index, { alt: e.target.value })}
                  placeholder="Texte alternatif (description)"
                  aria-label={`Texte alternatif de l'image ${index + 1}`}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={img.color ?? ALL_COLORS} onValueChange={(v) => setColor(index, v)}>
                    <SelectTrigger size="sm" className="min-w-0 flex-1" aria-label={`Couleur associée à l'image ${index + 1}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_COLORS}>Toutes les couleurs</SelectItem>
                      {colors.map((c) => (
                        <SelectItem key={c.name} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex shrink-0 items-center">
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Monter l'image ${index + 1}`}>
                      <ArrowUp aria-hidden />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(index, 1)} disabled={index === images.length - 1} aria-label={`Descendre l'image ${index + 1}`}>
                      <ArrowDown aria-hidden />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(index)} aria-label={`Supprimer l'image ${index + 1}`} className="text-destructive hover:text-destructive">
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted-foreground text-xs tabular-nums">
        {images.length} / {MAX_IMAGES} images
      </p>
    </FormSection>
  );
}
