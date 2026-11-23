import type { NextFunction, Request, Response } from "express";
import { prisma } from "../config/db";
import { unauthenticated } from "../utils/errors";
import { SESSION_COOKIE, verifyAdminToken, type AdminClaims } from "../utils/jwt";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminClaims;
    }
  }
}

/**
 * Protège les routes /api/admin/* : cookie de session httpOnly signé + le compte propriétaire doit toujours exister.
 * C'est CETTE vérification serveur qui protège l'administration (le garde côté navigateur n'est qu'un confort).
 */
export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  const claims = token ? await verifyAdminToken(token) : null;
  if (!claims) throw unauthenticated();
  const exists = await prisma.adminUser.findUnique({ where: { id: claims.sub }, select: { id: true } });
  if (!exists) throw unauthenticated();
  req.admin = claims;
  next();
}
