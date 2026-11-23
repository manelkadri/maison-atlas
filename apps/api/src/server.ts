import { createApp } from "./app";
import { prisma } from "./config/db";
import { env } from "./config/env";

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.log(`API prête sur http://localhost:${env.PORT}  (${env.NODE_ENV}, uploads : ${env.UPLOAD_DRIVER})`);
});

async function shutdown(signal: string) {
  console.log(`${signal} reçu : arrêt en cours…`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
