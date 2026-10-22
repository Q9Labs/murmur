import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "apps/mobile/src/lib/providers/realtimeTranslation.test.ts",
      "apps/worker/src/billing/creditPackExpiry.test.mjs",
      "apps/worker/src/billing/guestAccountMerge.test.js",
      "apps/worker/src/billing/realtimeUsageMeter.test.ts",
      "apps/worker/src/billing/revenueCatWebhookVerification.test.ts",
      "apps/worker/src/insights/deleteCustomerData.test.mjs",
      "apps/worker/src/sockets/realtime.test.ts",
    ],
  },
});
