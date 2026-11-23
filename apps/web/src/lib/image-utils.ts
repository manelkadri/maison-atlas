/**
 * Utilitaires d'images pour l'admin.
 * Mode mock : `fileToResizedDataUrl` redimensionne le fichier dans le navigateur (canvas) puis le convertit en data URL,
 * ce qui permet de le conserver dans le localStorage de la base mock (via `uploadService.uploadImage`).
 * Mode API : le fichier est envoyé tel quel au serveur (`services/api/upload.api.ts`), qui renvoie l'URL hébergée.
 */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 900;
export const IMAGE_QUALITY = 0.8;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Retourne un message d'erreur en français, ou null si le fichier est acceptable. */
export function validateImageFile(file: { type: string; size: number }): string | null {
  if (!file.type.startsWith("image/")) return "Ce fichier n'est pas une image.";
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) return "Format non pris en charge (JPEG, PNG ou WebP uniquement).";
  if (file.size > MAX_IMAGE_BYTES) return "L'image dépasse 5 Mo.";
  if (file.size === 0) return "Le fichier est vide.";
  return null;
}

/** Dimensions réduites pour tenir dans un carré `max` × `max` (jamais d'agrandissement). Fonction pure. */
export function fitWithin(width: number, height: number, max: number = MAX_IMAGE_DIMENSION): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Valide une référence d'image saisie à la main : chemin local `/images/...` ou `/uploads/...` (hébergé par l'API), URL https ou data URL image.
 * Retourne un message d'erreur ou null.
 */
export function validateImageReference(value: string): string | null {
  const v = value.trim();
  if (!v) return "Saisissez une URL ou un chemin d'image.";
  if (v.startsWith("/images/") || v.startsWith("/uploads/")) return null;
  if (v.startsWith("data:image/")) return null;
  try {
    const url = new URL(v);
    if (url.protocol === "https:" || url.protocol === "http:") return null;
  } catch {
    /* tombe dans le message ci-dessous */
  }
  return "Référence invalide : utilisez une URL http(s) ou un chemin /images/...";
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossible de lire cette image."));
    };
    img.src = url;
  });
}

/**
 * Redimensionne (≤ 900 px) et compresse l'image (WebP, sinon JPEG, qualité 0,8) puis renvoie une data URL.
 * Rejette avec un message français si le fichier est invalide.
 */
export async function fileToResizedDataUrl(file: File): Promise<string> {
  const problem = validateImageFile(file);
  if (problem) throw new Error(problem);
  const img = await loadImage(file);
  const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Le traitement d'image n'est pas disponible sur ce navigateur.");
  ctx.drawImage(img, 0, 0, width, height);
  const webp = canvas.toDataURL("image/webp", IMAGE_QUALITY);
  if (webp.startsWith("data:image/webp")) return webp;
  // Navigateur sans encodeur WebP : JPEG sur fond blanc (pas de transparence).
  const flat = document.createElement("canvas");
  flat.width = width;
  flat.height = height;
  const flatCtx = flat.getContext("2d");
  if (!flatCtx) throw new Error("Le traitement d'image n'est pas disponible sur ce navigateur.");
  flatCtx.fillStyle = "#ffffff";
  flatCtx.fillRect(0, 0, width, height);
  flatCtx.drawImage(img, 0, 0, width, height);
  return flat.toDataURL("image/jpeg", IMAGE_QUALITY);
}
