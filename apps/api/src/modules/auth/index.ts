import { adminChangeEmailSchema, adminChangePasswordSchema, adminLoginSchema } from "@fashion/validators";
import { Router, type CookieOptions, type Response } from "express";
import { prisma } from "../../config/db";
import { env, isProduction } from "../../config/env";
import { credentialsLimiter, loginLimiter } from "../../middlewares/security";
import { conflict, forbidden, unauthenticated, validation } from "../../utils/errors";
import { SESSION_COOKIE, signAdminToken, verifyAdminToken } from "../../utils/jwt";
import { hashPassword, validateAdminPassword, verifyPassword } from "../../utils/password";
import { parseBody } from "../../utils/validate";

/** Un seul message pour « e-mail inconnu » et « mauvais mot de passe » : on ne révèle jamais lequel des deux. */
const LOGIN_FAILED = "E-mail ou mot de passe incorrect.";

const cookieBase: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: isProduction,
  path: "/",
};

const noStore = (res: Response) => res.setHeader("Cache-Control", "no-store");

/** Module « auth » — routes publiques (montées sur /api) et routes admin (montées sur /api/admin, session obligatoire). */
export const publicRoutes = Router();
export const adminRoutes = Router();

publicRoutes.post("/login", loginLimiter(), async (req, res) => {
  const { email, password } = parseBody(adminLoginSchema, req);
  const user = await prisma.adminUser.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  const ok = await verifyPassword(password, user?.passwordHash);
  if (!user || !ok) throw unauthenticated(LOGIN_FAILED);

  const token = await signAdminToken({ sub: user.id, email: user.email });
  res.cookie(SESSION_COOKIE, token, { ...cookieBase, maxAge: env.SESSION_HOURS * 3600 * 1000 });
  noStore(res);
  res.json({ email: user.email });
});

publicRoutes.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, cookieBase);
  noStore(res);
  res.status(204).end();
});

/**
 * Routes admin (session obligatoire : `requireAdmin` renseigne `req.admin`).
 * Un mot de passe actuel erroné répond 403 (et non 401) : le client web traite un 401 « admin » comme une session
 * expirée et redirigerait vers la page de connexion au lieu d'afficher l'erreur dans le formulaire.
 */
const WRONG_CURRENT_PASSWORD = "Le mot de passe actuel est incorrect.";

adminRoutes.post("/change-password", credentialsLimiter(), async (req, res) => {
  const { currentPassword, newPassword } = parseBody(adminChangePasswordSchema, req);
  const user = await prisma.adminUser.findUnique({ where: { id: req.admin!.sub } });
  if (!user) throw unauthenticated();
  if (!(await verifyPassword(currentPassword, user.passwordHash))) throw forbidden(WRONG_CURRENT_PASSWORD);
  const weak = validateAdminPassword(newPassword);
  if (weak) throw validation(weak);

  await prisma.adminUser.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } });
  noStore(res);
  res.status(204).end();
});

adminRoutes.post("/change-email", credentialsLimiter(), async (req, res) => {
  const { currentPassword, newEmail } = parseBody(adminChangeEmailSchema, req);
  const user = await prisma.adminUser.findUnique({ where: { id: req.admin!.sub } });
  if (!user) throw unauthenticated();
  if (!(await verifyPassword(currentPassword, user.passwordHash))) throw forbidden(WRONG_CURRENT_PASSWORD);

  const email = newEmail.toLowerCase();
  const taken = await prisma.adminUser.findFirst({ where: { id: { not: user.id }, email: { equals: email, mode: "insensitive" } }, select: { id: true } });
  if (taken) throw conflict("Cette adresse e-mail est déjà utilisée.");

  const updated = await prisma.adminUser.update({ where: { id: user.id }, data: { email }, select: { id: true, email: true } });
  // Le jeton porte l'e-mail : on le réémet pour que la session reste cohérente avec le compte.
  const token = await signAdminToken({ sub: updated.id, email: updated.email });
  res.cookie(SESSION_COOKIE, token, { ...cookieBase, maxAge: env.SESSION_HOURS * 3600 * 1000 });
  noStore(res);
  res.json({ email: updated.email });
});

publicRoutes.get("/me", async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  const claims = token ? await verifyAdminToken(token) : null;
  const user = claims ? await prisma.adminUser.findUnique({ where: { id: claims.sub }, select: { email: true } }) : null;
  if (!user) throw unauthenticated();
  noStore(res);
  res.json({ email: user.email });
});
