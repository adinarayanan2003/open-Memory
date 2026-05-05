import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.db.test.ts"],
    exclude: ["dist/**", "node_modules/**"]
  }
});
