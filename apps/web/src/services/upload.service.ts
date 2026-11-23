import { fileToResizedDataUrl } from "@/lib/image-utils";
import type { UploadService } from "./contracts";
import { ServiceError } from "./errors";

/**
 * Téléversement SIMULÉ (mode mock) : l'image est redimensionnée dans le navigateur puis renvoyée en data-URL,
 * ce qui permet de la conserver dans le localStorage de la base mock.
 */
export const uploadService: UploadService = {
  async uploadImage(file) {
    try {
      return { url: await fileToResizedDataUrl(file) };
    } catch (error) {
      throw new ServiceError("VALIDATION", error instanceof Error ? error.message : "Impossible de traiter cette image.");
    }
  },
};
