import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env";

const key = new TextEncoder().encode(env.JWT_SECRET);
export const SESSION_COOKIE = "admin_session";

export type AdminClaims = { sub: string; email: string };

export async function signAdminToken(claims: AdminClaims): Promise<string> {
  return new SignJWT({ email: claims.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${env.SESSION_HOURS}h`)
    .sign(key);
}

export async function verifyAdminToken(token: string): Promise<AdminClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.email !== "string") return null;
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}
