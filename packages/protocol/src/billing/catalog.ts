export type StoreProvider = "apple" | "google";
export type BillingProductCode =
  | "pro_monthly" | "pro_annual" | "pro_max_monthly" | "pro_max_annual"
  | "pro_monthly_lite" | "pro_annual_lite" | "pro_monthly_in" | "pro_annual_in"
  | "credits_60" | "credits_30_lite" | "credits_300" | "credits_180" | "credits_540";
export type BillingProductKind = "subscription" | "credit_pack";
export type BillingProduct = {
  appleProductId: string;
  basePriceUsdCents: number | null;
  code: BillingProductCode;
  googleOfferId?: string;
  googleProductId: string;
  grantMs: number;
  kind: BillingProductKind;
  personalOffer?: boolean;
  revenueCatPackageId: string;
};

export const freeAllowanceMs = 7 * 60_000;
export const proAllowanceMs = 120 * 60_000;
export const proMaxAllowanceMs = 400 * 60_000;
export const liteProAllowanceMs = 90 * 60_000;
export const creditPackValidityMs = 90 * 24 * 60 * 60_000;

export const billingProducts: readonly BillingProduct[] = [
  {
    appleProductId: "com.q9labsai.murmur.pro.monthly",
    basePriceUsdCents: 999, code: "pro_monthly", googleProductId: "murmur_pro:monthly",
    grantMs: proAllowanceMs, kind: "subscription", revenueCatPackageId: "$rc_monthly",
  },
  {
    appleProductId: "com.q9labsai.murmur.pro.annual",
    basePriceUsdCents: 9_999, code: "pro_annual", googleProductId: "murmur_pro:annual",
    grantMs: proAllowanceMs, kind: "subscription", revenueCatPackageId: "$rc_annual",
  },
  {
    appleProductId: "com.q9labsai.murmur.pro.monthly.offer",
    basePriceUsdCents: 999, code: "pro_monthly", googleOfferId: "personal-20",
    googleProductId: "murmur_pro:monthly", grantMs: proAllowanceMs, kind: "subscription",
    personalOffer: true, revenueCatPackageId: "$rc_monthly",
  },
  {
    appleProductId: "com.q9labsai.murmur.pro.annual.offer",
    basePriceUsdCents: 9_999, code: "pro_annual", googleOfferId: "personal-20",
    googleProductId: "murmur_pro:annual", grantMs: proAllowanceMs, kind: "subscription",
    personalOffer: true, revenueCatPackageId: "$rc_annual",
  },
  {
    appleProductId: "com.q9labsai.murmur.promax.monthly",
    basePriceUsdCents: 2_999, code: "pro_max_monthly", googleProductId: "murmur_promax:monthly",
    grantMs: proMaxAllowanceMs, kind: "subscription", revenueCatPackageId: "promax_monthly",
  },
  {
    appleProductId: "com.q9labsai.murmur.promax.annual",
    basePriceUsdCents: 29_999, code: "pro_max_annual", googleProductId: "murmur_promax:annual",
    grantMs: proMaxAllowanceMs, kind: "subscription", revenueCatPackageId: "promax_annual",
  },
  {
    appleProductId: "com.q9labsai.murmur.pro.monthly.lite",
    basePriceUsdCents: null, code: "pro_monthly_lite", googleProductId: "murmur_pro_lite:monthly",
    grantMs: liteProAllowanceMs, kind: "subscription", revenueCatPackageId: "$rc_monthly",
  },
  {
    appleProductId: "com.q9labsai.murmur.pro.annual.lite",
    basePriceUsdCents: null, code: "pro_annual_lite", googleProductId: "murmur_pro_lite:annual",
    grantMs: liteProAllowanceMs, kind: "subscription", revenueCatPackageId: "$rc_annual",
  },
  {
    appleProductId: "com.q9labsai.murmur.pro.monthly.lite.offer",
    basePriceUsdCents: null, code: "pro_monthly_lite", googleOfferId: "personal-20",
    googleProductId: "murmur_pro_lite:monthly", grantMs: liteProAllowanceMs,
    kind: "subscription", personalOffer: true, revenueCatPackageId: "$rc_monthly",
  },
  {
    appleProductId: "com.q9labsai.murmur.pro.annual.lite.offer",
    basePriceUsdCents: null, code: "pro_annual_lite", googleOfferId: "personal-20",
    googleProductId: "murmur_pro_lite:annual", grantMs: liteProAllowanceMs,
    kind: "subscription", personalOffer: true, revenueCatPackageId: "$rc_annual",
  },
  {
    appleProductId: "com.q9labsai.murmur.credits.60",
    basePriceUsdCents: 799, code: "credits_60", googleProductId: "murmur_credits_60",
    grantMs: 60 * 60_000, kind: "credit_pack", revenueCatPackageId: "trip_pass_60",
  },
  {
    appleProductId: "com.q9labsai.murmur.credits.30.lite",
    basePriceUsdCents: null, code: "credits_30_lite", googleProductId: "murmur_credits_30_lite",
    grantMs: 30 * 60_000, kind: "credit_pack", revenueCatPackageId: "trip_pass_30",
  },
  {
    appleProductId: "com.q9labsai.murmur.credits.300",
    basePriceUsdCents: 2_999, code: "credits_300", googleProductId: "murmur_credits_300",
    grantMs: 300 * 60_000, kind: "credit_pack", revenueCatPackageId: "event_pass_300",
  },
];

const legacyBillingProducts: readonly BillingProduct[] = [
  {
    appleProductId: "com.q9labsai.murmur.pro.monthly.offer",
    basePriceUsdCents: 1_299, code: "pro_monthly", googleProductId: "murmur_pro_offer:monthly",
    grantMs: 180 * 60_000, kind: "subscription", personalOffer: true,
    revenueCatPackageId: "$rc_monthly",
  },
  {
    appleProductId: "com.q9labsai.murmur.pro.annual.offer",
    basePriceUsdCents: 12_499, code: "pro_annual", googleProductId: "murmur_pro_offer:annual",
    grantMs: 180 * 60_000, kind: "subscription", personalOffer: true,
    revenueCatPackageId: "$rc_annual",
  },
  {
    appleProductId: "com.q9labsai.murmur.pro.monthly.in.offer",
    basePriceUsdCents: null, code: "pro_monthly_in", googleProductId: "murmur_pro_in_offer:monthly",
    grantMs: liteProAllowanceMs, kind: "subscription", personalOffer: true,
    revenueCatPackageId: "monthly_in",
  },
  {
    appleProductId: "com.q9labsai.murmur.pro.annual.in.offer",
    basePriceUsdCents: null, code: "pro_annual_in", googleProductId: "murmur_pro_in_offer:annual",
    grantMs: liteProAllowanceMs, kind: "subscription", personalOffer: true,
    revenueCatPackageId: "annual_in",
  },
  {
    appleProductId: "com.q9labsai.murmur.credits.180",
    basePriceUsdCents: 1_099, code: "credits_180", googleProductId: "murmur_credits_180",
    grantMs: 180 * 60_000, kind: "credit_pack", revenueCatPackageId: "credits_180",
  },
  {
    appleProductId: "com.q9labsai.murmur.credits.540",
    basePriceUsdCents: 3_199, code: "credits_540", googleProductId: "murmur_credits_540",
    grantMs: 540 * 60_000, kind: "credit_pack", revenueCatPackageId: "credits_540",
  },
];
const recognizedBillingProducts: readonly BillingProduct[] = [
  ...billingProducts,
  ...legacyBillingProducts,
];

export function findBillingProduct(
  provider: StoreProvider,
  productId: string,
  offerId: string | null = null,
): BillingProduct | null {
  return recognizedBillingProducts.find((product) => provider === "apple"
    ? product.appleProductId === productId
    : product.googleProductId === productId && (product.googleOfferId ?? null) === offerId) ?? null;
}

export function isPersonalOfferProduct(productId: string, offerId: string | null = null): boolean {
  return recognizedBillingProducts.some((product) => product.personalOffer === true &&
    (product.appleProductId === productId ||
      (product.googleProductId === productId && (product.googleOfferId ?? null) === offerId)));
}
