export type StoreProvider = "apple" | "google";

export type BillingProductCode =
  | "pro_monthly"
  | "pro_annual"
  | "pro_monthly_in"
  | "pro_annual_in"
  | "credits_60"
  | "credits_180"
  | "credits_540";

export type BillingProductKind = "subscription" | "credit_pack";

export type BillingProduct = {
  appleProductId: string;
  basePriceUsdCents: number | null;
  code: BillingProductCode;
  googleProductId: string;
  grantMs: number;
  kind: BillingProductKind;
  personalOffer?: boolean;
  revenueCatPackageId: string;
};

export const freeAllowanceMs = 5 * 60 * 1_000;
export const proAllowanceMs = 180 * 60 * 1_000;

export const billingProducts: readonly BillingProduct[] = [
  {
    appleProductId: "com.q9labsai.murmur.pro.monthly",
    basePriceUsdCents: 1_299,
    code: "pro_monthly",
    googleProductId: "murmur_pro:monthly",
    grantMs: proAllowanceMs,
    kind: "subscription",
    revenueCatPackageId: "$rc_monthly",
  },
  {
    appleProductId: "com.q9labsai.murmur.pro.annual",
    basePriceUsdCents: 12_499,
    code: "pro_annual",
    googleProductId: "murmur_pro:annual",
    grantMs: proAllowanceMs,
    kind: "subscription",
    revenueCatPackageId: "$rc_annual",
  },
  {
    appleProductId: "com.q9labsai.murmur.pro.monthly.offer",
    basePriceUsdCents: 1_299,
    code: "pro_monthly",
    googleProductId: "murmur_pro_offer:monthly",
    grantMs: proAllowanceMs,
    kind: "subscription",
    personalOffer: true,
    revenueCatPackageId: "$rc_monthly",
  },
  {
    appleProductId: "com.q9labsai.murmur.pro.annual.offer",
    basePriceUsdCents: 12_499,
    code: "pro_annual",
    googleProductId: "murmur_pro_offer:annual",
    grantMs: proAllowanceMs,
    kind: "subscription",
    personalOffer: true,
    revenueCatPackageId: "$rc_annual",
  },
  {
    appleProductId: "com.q9labsai.murmur.pro.monthly.in.offer",
    basePriceUsdCents: null,
    code: "pro_monthly_in",
    googleProductId: "murmur_pro_in_offer:monthly",
    grantMs: 90 * 60 * 1_000,
    kind: "subscription",
    personalOffer: true,
    revenueCatPackageId: "monthly_in",
  },
  {
    appleProductId: "com.q9labsai.murmur.pro.annual.in.offer",
    basePriceUsdCents: null,
    code: "pro_annual_in",
    googleProductId: "murmur_pro_in_offer:annual",
    grantMs: 90 * 60 * 1_000,
    kind: "subscription",
    personalOffer: true,
    revenueCatPackageId: "annual_in",
  },
  {
    appleProductId: "com.q9labsai.murmur.credits.60",
    basePriceUsdCents: 399,
    code: "credits_60",
    googleProductId: "murmur_credits_60",
    grantMs: 60 * 60 * 1_000,
    kind: "credit_pack",
    revenueCatPackageId: "credits_60",
  },
  {
    appleProductId: "com.q9labsai.murmur.credits.180",
    basePriceUsdCents: 1_099,
    code: "credits_180",
    googleProductId: "murmur_credits_180",
    grantMs: 180 * 60 * 1_000,
    kind: "credit_pack",
    revenueCatPackageId: "credits_180",
  },
  {
    appleProductId: "com.q9labsai.murmur.credits.540",
    basePriceUsdCents: 3_199,
    code: "credits_540",
    googleProductId: "murmur_credits_540",
    grantMs: 540 * 60 * 1_000,
    kind: "credit_pack",
    revenueCatPackageId: "credits_540",
  },
];

export function findBillingProduct(
  provider: StoreProvider,
  productId: string,
): BillingProduct | null {
  return (
    billingProducts.find((product) =>
      provider === "apple"
        ? product.appleProductId === productId
        : product.googleProductId === productId,
    ) ?? null
  );
}

export function isPersonalOfferProduct(productId: string): boolean {
  return billingProducts.some((product) => product.personalOffer === true &&
    (product.appleProductId === productId || product.googleProductId === productId));
}
