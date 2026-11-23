import { NextResponse, type NextRequest } from "next/server";

/** Nom du cookie de session posé par l'API (voir docs/API_CONTRACT.md). */
const ADMIN_SESSION_COOKIE = "admin_session";

/**
 * Proxy Next 16 (remplace `middleware.ts`).
 *
 * Mode API uniquement (`NEXT_PUBLIC_DATA_SOURCE=api`) : une requête vers `/admin/dashboard/**` sans cookie
 * `admin_session` est redirigée vers `/admin/login`. Mode mock : ne fait rien.
 *
 * CONFORT D'USAGE, PAS UNE PROTECTION : le cookie est seulement testé pour sa PRÉSENCE (il n'est pas vérifié ici).
 * La vraie protection est celle de l'API, qui répond 401 à toute route `/api/admin/*` sans session valide.
 */
export function proxy(request: NextRequest): NextResponse {
  if (process.env.NEXT_PUBLIC_DATA_SOURCE !== "api") return NextResponse.next();

  if (!request.cookies.has(ADMIN_SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/dashboard", "/admin/dashboard/:path*"],
};
