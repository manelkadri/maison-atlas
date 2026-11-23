/**
 * Point d'entrée DÉTECTÉ PAR VERCEL (il cherche `src/app.*`, `src/index.*` ou `src/server.*` et exige que le
 * fichier importe « express » : détection statique).
 *
 * L'API elle-même est regroupée en un seul fichier par tsup (voir tsup.config.ts) car ses sources utilisent des
 * imports sans extension et des paquets du monorepo (@fashion/*) livrés en TypeScript, que Node ne sait pas charger.
 * Ce fichier ne fait que monter l'application regroupée. Il est volontairement EXCLU de `tsconfig.json`
 * (le bundle `dist/` n'existe pas avant le build) et vérifié par `tsconfig.build.json`, après tsup.
 */
import express from "express";
import api from "../dist/handler.js";

const app = express();
app.disable("x-powered-by");
app.use(api);

export default app;
