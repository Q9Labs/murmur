import { describe, expect, it } from "vitest";

import { allocateDebit, type SpendableGrant } from "./allocation";

const nowMs = Date.UTC(2026, 7, 29);

describe("usage allocation", () => {
  it("spends expiring allowance before non-expiring credits", () => {
    const grants: SpendableGrant[] = [
      {
        createdAtMs: nowMs - 2_000,
        expiresAtMs: null,
        grantId: "credits",
        remainingMs: 10_000,
      },
      {
        createdAtMs: nowMs - 1_000,
        expiresAtMs: nowMs + 10_000,
        grantId: "allowance",
        remainingMs: 3_000,
      },
    ];

    expect(allocateDebit(grants, 5_000, nowMs)).toEqual({
      allocations: [
        { amountMs: 3_000, grantId: "allowance" },
        { amountMs: 2_000, grantId: "credits" },
      ],
      ok: true,
    });
  });

  it("spends the oldest credit grant first", () => {
    const grants: SpendableGrant[] = [
      { createdAtMs: 2, expiresAtMs: null, grantId: "new", remainingMs: 5_000 },
      { createdAtMs: 1, expiresAtMs: null, grantId: "old", remainingMs: 5_000 },
    ];

    expect(allocateDebit(grants, 7_000, nowMs)).toEqual({
      allocations: [
        { amountMs: 5_000, grantId: "old" },
        { amountMs: 2_000, grantId: "new" },
      ],
      ok: true,
    });
  });

  it("does not spend expired or insufficient value", () => {
    const grants: SpendableGrant[] = [
      { createdAtMs: 1, expiresAtMs: nowMs, grantId: "expired", remainingMs: 9_000 },
      { createdAtMs: 2, expiresAtMs: null, grantId: "credits", remainingMs: 2_000 },
    ];

    expect(allocateDebit(grants, 3_000, nowMs)).toEqual({ availableMs: 2_000, ok: false });
  });
});
