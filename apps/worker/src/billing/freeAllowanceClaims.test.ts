import { describe, expect, it } from "vitest";

import { freeAllowanceClaimHashFromRequest } from "./freeAllowanceClaims";

describe("Free allowance claim identity", () => {
  it("hashes the retained allowance identity without storing its raw value", async () => {
    const request = new Request("https://worker.example.test/v3/customer", {
      headers: { "x-murmur-free-allowance-id": "free_install_123" },
    });

    const firstHash = await freeAllowanceClaimHashFromRequest(request, {
      SESSION_HASH_SALT: "test-salt",
    });
    const secondHash = await freeAllowanceClaimHashFromRequest(request, {
      SESSION_HASH_SALT: "test-salt",
    });

    expect(firstHash).toMatch(/^[a-f0-9]{64}$/);
    expect(secondHash).toBe(firstHash);
    expect(firstHash).not.toContain("free_install_123");
  });

  it("rejects missing and oversized allowance identities", async () => {
    await expect(freeAllowanceClaimHashFromRequest(
      new Request("https://worker.example.test/v3/customer"),
      {},
    )).resolves.toBeNull();
    await expect(freeAllowanceClaimHashFromRequest(
      new Request("https://worker.example.test/v3/customer", {
        headers: { "x-murmur-free-allowance-id": "x".repeat(257) },
      }),
      {},
    )).resolves.toBeNull();
  });
});
