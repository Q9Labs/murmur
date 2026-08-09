import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["**/*.test.{js,mjs,ts,tsx}", "**/*.d.ts"],
      include: [
        "app/**/*.{ts,tsx}",
        "modules/murmur-audio/{index.ts,src/**/*.ts}",
        "plugins/**/*.{js,mjs,ts}",
        "src/**/*.{ts,tsx}",
      ],
      provider: "v8",
      thresholds: {
        branches: 26,
        functions: 27,
        lines: 28,
        statements: 28,
      },
    },
  },
});
