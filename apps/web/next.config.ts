import type { NextConfig } from "next";

/** Serveur API vu depuis le serveur Next (réécritures). Jamais exposé au navigateur : il appelle `/api/*` en même origine. */
const API_INTERNAL_URL = (process.env.API_INTERNAL_URL?.trim() || "http://localhost:4000").replace(/\/+$/, "");

type RemotePattern = NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>[number];

/** Autorise les images `/uploads/**` servies par l'API si elles sont référencées en URL absolue. */
function apiUploadsPattern(): RemotePattern[] {
  try {
    const url = new URL(API_INTERNAL_URL);
    const protocol = url.protocol === "https:" ? "https" : "http";
    return [{ protocol, hostname: url.hostname, ...(url.port ? { port: url.port } : {}), pathname: "/uploads/**" }];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Les packages du monorepo sont consommés en TypeScript source.
  transpilePackages: ["@fashion/types", "@fashion/shared", "@fashion/validators"],
  images: {
    // Images locales autorisées : visuels de démonstration (`/images`) et images téléversées servies par l'API (`/uploads`).
    localPatterns: [{ pathname: "/images/**" }, { pathname: "/uploads/**" }],
    // 90 : photo plein écran de l'accueil (netteté) ; 75 : défaut pour le reste.
    qualities: [75, 90],
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }, ...apiUploadsPattern()],
  },
  async rewrites() {
    // Le navigateur appelle l'API en même origine : pas de CORS, et le cookie de session `SameSite=Lax` accompagne les requêtes.
    return {
      afterFiles: [
        { source: "/api/:path*", destination: `${API_INTERNAL_URL}/api/:path*` },
        { source: "/uploads/:path*", destination: `${API_INTERNAL_URL}/uploads/:path*` },
      ],
    };
  },
  poweredByHeader: false,
};

export default nextConfig;
