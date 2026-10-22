import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/security/**/*.test.ts"],
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    fileParallelism: false,
    maxConcurrency: 1,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
