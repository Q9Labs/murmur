import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        "**/*.test.ts",
        "**/*.d.ts",
        // These adapters require Cloudflare D1/DO, Better Auth, and RevenueCat sandbox
        // lifecycle tests. Pure billing rules and protocol verification remain covered.
        "src/auth/auth.ts",
        "src/billing/allowanceService.ts",
        "src/billing/customerLedgerDurableObject.ts",
        "src/billing/guestAccountMerge.ts",
        "src/billing/ledgerRepository.ts",
        "src/billing/revenueCatEventRepository.ts",
        "src/billing/revenueCatProcessor.ts",
        "src/billing/revenueCatReconciliation.ts",
        "src/billing/usageSessionStore.ts",
        "src/routes/customer.ts",
        "src/routes/reconcileBilling.ts",
        "src/routes/revenueCatWebhook.ts",
      ],
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
