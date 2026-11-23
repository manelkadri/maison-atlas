import { defineConfig } from "tsup";
import { writeFileSync } from "node:fs";

/**
 * Regroupe l'API pour la production :
 *  - dist/handler.js : application Express (fonction Vercel, via src/index.ts) ;
 *  - dist/server.js  : démarrage classique avec `listen` (`pnpm start`, Docker, hébergeur Node).
 *
 * Les paquets du monorepo (@fashion/*) sont intégrés (ils sont livrés en TypeScript) ; les dépendances npm restent
 * externes (elles sont installées/embarquées par la plateforme). @prisma/client reste externe : il charge son moteur
 * natif depuis node_modules.
 */
export default defineConfig({
  entry: ["src/handler.ts", "src/server.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  splitting: false,
  sourcemap: false,
  noExternal: [/^@fashion\//],
  external: ["@prisma/client"],
  onSuccess() {
    // Déclaration du bundle pour que `src/index.ts` soit vérifié par TypeScript (tsconfig.build.json) sans rien masquer.
    writeFileSync("dist/handler.d.ts", 'import type { Express } from "express";\ndeclare const app: Express;\nexport default app;\n');
    return Promise.resolve();
  },
});
