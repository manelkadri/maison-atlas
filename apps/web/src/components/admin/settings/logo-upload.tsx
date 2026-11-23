"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isApiMode } from "@/lib/api-config";
import { getErrorMessage, uploadService } from "@/services";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const WORK_SIDE = 900; // résolution de travail (rognage précis)
const MAX_SIDE = 480; // taille finale conservée

/**
 * Rogne les marges vides autour du logo. Sans cela, un logo exporté avec beaucoup de marge
 * (fond transparent ou blanc) apparaît minuscule dans l'en-tête, même à grande taille d'affichage.
 * - image avec transparence : on retire les pixels transparents ;
 * - image opaque : on retire les pixels proches de la couleur du coin supérieur gauche (le fond).
 */
function trimMargins(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const { width: w, height: h } = canvas;
  const { data } = ctx.getImageData(0, 0, w, h);

  let hasAlpha = false;
  for (let i = 3; i < data.length; i += 4) {
    if ((data[i] ?? 255) < 250) {
      hasAlpha = true;
      break;
    }
  }
  const [br = 255, bg = 255, bb = 255] = [data[0], data[1], data[2]];
  const isBackground = (i: number): boolean =>
    hasAlpha
      ? (data[i + 3] ?? 0) < 16
      : Math.abs((data[i] ?? 0) - br) + Math.abs((data[i + 1] ?? 0) - bg) + Math.abs((data[i + 2] ?? 0) - bb) < 48;

  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isBackground((y * w + x) * 4)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return canvas; // image entièrement « fond » : on ne touche à rien

  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.03);
  const sx = Math.max(0, minX - pad);
  const sy = Math.max(0, minY - pad);
  const sw = Math.min(w, maxX + pad + 1) - sx;
  const sh = Math.min(h, maxY + pad + 1) - sy;
  const out = document.createElement("canvas");
  out.width = sw;
  out.height = sh;
  out.getContext("2d")?.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return out;
}

/** Redimensionne l'image côté navigateur, rogne les marges vides et renvoie un fichier PNG prêt à être téléversé. */
async function trimAndResize(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, WORK_SIDE / Math.max(bitmap.width, bitmap.height));
  const work = document.createElement("canvas");
  work.width = Math.max(1, Math.round(bitmap.width * scale));
  work.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = work.getContext("2d");
  if (!ctx) throw new Error("Traitement de l'image impossible dans ce navigateur.");
  ctx.drawImage(bitmap, 0, 0, work.width, work.height);
  bitmap.close();

  const trimmed = trimMargins(work);
  const finalScale = Math.min(1, MAX_SIDE / Math.max(trimmed.width, trimmed.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(trimmed.width * finalScale));
  canvas.height = Math.max(1, Math.round(trimmed.height * finalScale));
  canvas.getContext("2d")?.drawImage(trimmed, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Traitement de l'image impossible dans ce navigateur.");
  return new File([blob], "logo.png", { type: "image/png" });
}

/** Évite de passer à next/image une adresse en cours de saisie (ex. « https:// »), qui ferait échouer le rendu. */
function isRenderable(src: string): boolean {
  if (src.startsWith("data:image/") || (src.startsWith("/") && !src.startsWith("//"))) return true;
  try {
    const url = new URL(src);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".");
  } catch {
    return false;
  }
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  storeName: string;
};

/** Logo : import d'un fichier (rogné puis téléversé via `uploadService`) ou saisie d'une URL, avec aperçu. */
export function LogoUpload({ value, onChange, storeName }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isDataUrl = value.startsWith("data:");

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Le fichier doit être une image (PNG, JPG, SVG, WebP).");
    if (file.size > MAX_FILE_BYTES) return setError("Image trop lourde (5 Mo maximum).");
    setBusy(true);
    try {
      // Le rognage des marges se fait AVANT l'envoi : on téléverse le logo déjà rogné.
      const { url } = await uploadService.uploadImage(await trimAndResize(file));
      onChange(url);
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de lire cette image."));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className="bg-secondary flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border">
          {value && isRenderable(value) ? (
            <Image src={value} alt={`Logo de ${storeName}`} width={80} height={80} unoptimized className="size-full object-contain" />
          ) : (
            <ImagePlus className="text-muted-foreground size-6" aria-hidden />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={inputRef} id="logo-file" type="file" accept="image/*" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
            <ImagePlus aria-hidden /> {value ? "Remplacer le logo" : "Importer un logo"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
              <Trash2 aria-hidden /> Retirer
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="logo-url" className="text-muted-foreground text-xs">
          Ou adresse d&apos;une image
        </Label>
        <Input
          id="logo-url"
          value={isDataUrl ? "" : value}
          placeholder={isDataUrl ? "Image importée depuis votre appareil" : "/images/brand.svg ou https://…"}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <p className="text-muted-foreground text-xs">
        {isApiMode()
          ? "L'image est redimensionnée, ses marges vides sont rognées automatiquement, puis elle est envoyée au serveur de la boutique."
          : "Import simulé : l'image est redimensionnée, ses marges vides sont rognées automatiquement, puis elle est gardée dans ce navigateur."}
      </p>
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
