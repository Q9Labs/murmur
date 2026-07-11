import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["**/*.test.ts", "**/*.d.ts"],
      include: ["src/**/*.ts"],
      provider: "v8",
      thresholds: {
        branches: 85,
        functions: 95,
        lines: 93,
        statements: 94,
      },
    },
  },
});
