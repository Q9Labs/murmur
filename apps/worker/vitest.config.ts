import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["**/*.test.ts", "**/*.d.ts"],
      include: ["src/**/*.ts"],
      provider: "v8",
      thresholds: {
        branches: 74,
        functions: 80,
        lines: 77,
        statements: 76,
      },
    },
  },
});
