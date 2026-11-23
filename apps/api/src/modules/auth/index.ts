import { adminLoginSchema } from "@fashion/validators";
import { Router, type CookieOptions, type Response } from "express";
import { prisma } from "../../config/db";
import { env, isProduction } from "../../config/env";
import { loginLimiter } from "../../middlewares/security";
import { unauthenticated } from "../../utils/errors";
import { SESSION_COOKIE, signAdminToken, verifyAdminToken } from "../../utils/jwt";
import { verifyPassword } from "../../utils/password";
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

publicRoutes.get("/me", async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  const claims = token ? await verifyAdminToken(token) : null;
  const user = claims ? await prisma.adminUser.findUnique({ where: { id: claims.sub }, select: { email: true } }) : null;
  if (!user) throw unauthenticated();
  noStore(res);
  res.json({ email: user.email });
});
