import { v2 as cloudinary } from "cloudinary";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { env } from "../../config/env";
import { notConfigured } from "../../utils/errors";
import type { ImageKind } from "./signature";

export type UploadedFile = { url: string; publicId: string };

/** Fichier déjà validé (taille + signature binaire) et dont le nom est généré par le serveur. */
export type UploadInput = { buffer: Buffer; kind: ImageKind; baseName: string };

/** Couche de stockage des images. Les routes ne connaissent que cette interface (testable avec un faux). */
export interface UploadDriver {
  readonly name: "local" | "cloudinary";
  save(input: UploadInput): Promise<UploadedFile>;
}

/** Nom aléatoire (128 bits) : jamais le nom d'origine, donc ni collision, ni traversée de chemin, ni fuite d'information. */
export const generateBaseName = () => randomBytes(16).toString("hex");

/** Driver « local » (développement) : écrit dans UPLOAD_DIR, servi par l'application sur /uploads. */
export function createLocalDriver(dir: string): UploadDriver {
  const root = resolve(process.cwd(), dir);
  return {
    name: "local",
    async save({ buffer, kind, baseName }) {
      const fileName = `${baseName}.${kind.ext}`;
      await mkdir(root, { recursive: true });
      await writeFile(join(root, fileName), buffer, { flag: "wx" });
      return { url: `/uploads/${fileName}`, publicId: fileName };
    },
  };
}

/** Sous-ensemble du SDK Cloudinary utilisé ici (permet d'injecter un faux dans les tests). */
export type CloudinaryResult = { secure_url: string; public_id: string };
export interface CloudinaryLike {
  uploader: {
    upload_stream(
      options: { folder: string; public_id: string; resource_type: "image"; overwrite: boolean },
      callback: (error: unknown, result: CloudinaryResult | undefined) => void,
    ): { end(buffer: Buffer): unknown };
  };
}

export function createCloudinaryDriver(client: CloudinaryLike, folder: string): UploadDriver {
  return {
    name: "cloudinary",
    save({ buffer, baseName }) {
      return new Promise<UploadedFile>((resolvePromise, reject) => {
        const stream = client.uploader.upload_stream(
          { folder, public_id: baseName, resource_type: "image", overwrite: false },
          (error, result) => {
            if (error || !result) return reject(error instanceof Error ? error : new Error("Échec de l'envoi vers Cloudinary."));
            resolvePromise({ url: result.secure_url, publicId: result.public_id });
          },
        );
        stream.end(buffer);
      });
    },
  };
}

let override: UploadDriver | null = null;

/** Tests : impose un driver (null = retour au comportement normal selon l'environnement). */
export function setUploadDriverOverride(driver: UploadDriver | null) {
  override = driver;
}

let cloudinaryConfigured = false;

/** Choisit le driver d'après l'environnement. Cloudinary sans identifiants complets ⇒ NOT_CONFIGURED (501). */
export function resolveUploadDriver(): UploadDriver {
  if (override) return override;
  if (env.UPLOAD_DRIVER === "local") return createLocalDriver(env.UPLOAD_DIR);

  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: apiSecret } = env;
  if (!cloudName || !apiKey || !apiSecret) {
    throw notConfigured("Le stockage d'images Cloudinary n'est pas configuré.");
  }
  if (!cloudinaryConfigured) {
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
    cloudinaryConfigured = true;
  }
  return createCloudinaryDriver(cloudinary, env.CLOUDINARY_FOLDER);
}
