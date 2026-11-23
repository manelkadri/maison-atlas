import { Router, type NextFunction, type Request, type Response } from "express";
import multer, { MulterError } from "multer";
import { AppError, validation } from "../../utils/errors";
import { generateBaseName, resolveUploadDriver } from "./drivers";
import { detectImageKind } from "./signature";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 5, parts: 8 },
});

/** Exécute multer en convertissant ses erreurs dans le format d'erreur standard. */
function receiveFile(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") return next(new AppError(413, "VALIDATION", "Image trop volumineuse (5 Mo maximum)."));
      return next(validation("Envoyez un seul fichier image dans le champ « file »."));
    }
    // Corps non multipart ou flux interrompu.
    return next(validation("Envoi de fichier invalide."));
  });
}

/** Module « uploads » — routes publiques (montées sur /api) et routes admin (montées sur /api/admin, session obligatoire). */
export const publicRoutes = Router();
export const adminRoutes = Router();

adminRoutes.post(
  "/",
  (_req, _res, next) => {
    // Échoue tôt (501) si le driver demandé n'est pas configuré, avant de lire le fichier.
    resolveUploadDriver();
    next();
  },
  receiveFile,
  async (req, res) => {
    const file = req.file;
    if (!file) throw validation("Aucun fichier reçu (champ « file »).");
    const kind = detectImageKind(file.buffer);
    if (!kind) throw validation("Format non pris en charge : envoyez une image JPEG, PNG, WebP ou AVIF.");
    const saved = await resolveUploadDriver().save({ buffer: file.buffer, kind, baseName: generateBaseName() });
    res.status(201).json(saved);
  },
);
