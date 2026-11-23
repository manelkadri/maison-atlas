import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    // Une seule base partagée par tous les fichiers de test : exécution séquentielle.
    fileParallelism: false,
    pool: "forks",
    testTimeout: 30_000,
    hookTimeout: 90_000,
  },
});
