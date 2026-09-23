import { describe, expect, it } from "vitest";

import * as sharedCatalog from "@murmur/protocol/billing/catalog";
import * as workerCatalog from "./catalog";

describe("worker billing catalog", () => {
  it("serves the shared catalog the app previews are built from", () => {
    expect(workerCatalog.billingProducts).toBe(sharedCatalog.billingProducts);
    expect(workerCatalog.findBillingProduct).toBe(sharedCatalog.findBillingProduct);
    expect(workerCatalog.isPersonalOfferProduct).toBe(sharedCatalog.isPersonalOfferProduct);
  });
});
