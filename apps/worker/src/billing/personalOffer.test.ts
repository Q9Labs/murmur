import { describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/cloudflare", () => sentry);

import { defaultServerConfig } from "../serverConfig";
import {
  activePersonalOffer,
  queuePersonalOfferStart,
  redeemPersonalOffer,
  startPersonalOffer,
} from "./personalOffer";

function offerDatabase() {
  const rows = new Map<string, { expires_at_ms: number; redeemed: number; started_at_ms: number }>();
  const database = {
    prepare(query: string) {
      let values: (string | number)[] = [];
      return {
        bind(...input: (string | number)[]) {
          values = input;
          return this;
        },
        first: vi.fn().mockImplementation(async () => rows.get(String(values[0])) ?? null),
        run: vi.fn().mockImplementation(async () => {
          const customerId = String(values[0]);
          if (query.includes("INSERT INTO personal_offers") && !rows.has(customerId)) {
            rows.set(customerId, {
              started_at_ms: Number(values[1]),
              expires_at_ms: Number(values[2]),
              redeemed: 0,
            });
          }
          if (query.includes("UPDATE personal_offers")) {
            const existing = rows.get(customerId);
            if (existing) {
              existing.redeemed = 1;
            }
          }
          return { meta: { changes: 1 } };
        }),
      };
    },
  };
  return { database, rows };
}

describe("personal offers", () => {
  it("starts once per customer and never re-arms after expiry", async () => {
    const { database, rows } = offerDatabase();
    await startPersonalOffer(database, "customer-1", 1_000, 48);
    await startPersonalOffer(database, "customer-1", 1_000 + 50 * 3_600_000, 48);
    expect(rows.get("customer-1")).toEqual({
      started_at_ms: 1_000,
      expires_at_ms: 1_000 + 48 * 3_600_000,
      redeemed: 0,
    });
  });

  it("is active strictly before expiry and disappears at the boundary", async () => {
    const { database } = offerDatabase();
    const expiresAtMs = 1_000 + 48 * 3_600_000;
    await startPersonalOffer(database, "customer-1", 1_000, 48);
    await expect(activePersonalOffer(database, "customer-1", expiresAtMs - 1, "personal_offer"))
      .resolves.toEqual({ offering_id: "personal_offer", expires_at: new Date(expiresAtMs).toISOString() });
    await expect(activePersonalOffer(database, "customer-1", expiresAtMs, "personal_offer"))
      .resolves.toBeNull();
  });

  it("redeems only personal subscription products and never makes the offer active again", async () => {
    const { database, rows } = offerDatabase();
    await startPersonalOffer(database, "customer-1", 1_000, 48);
    await redeemPersonalOffer(database, "customer-1", "com.q9labsai.murmur.pro.annual");
    expect(rows.get("customer-1")?.redeemed).toBe(0);
    await redeemPersonalOffer(database, "customer-1", "com.q9labsai.murmur.pro.annual.offer");
    expect(rows.get("customer-1")?.redeemed).toBe(1);
    await expect(activePersonalOffer(database, "customer-1", 2_000, "personal_offer"))
      .resolves.toBeNull();
    await startPersonalOffer(database, "customer-1", 2_000, 48);
    expect(rows.get("customer-1")?.redeemed).toBe(1);
  });

  it("recognizes regional personal products", async () => {
    const { database, rows } = offerDatabase();
    await startPersonalOffer(database, "customer-2", 1_000, 48);
    await redeemPersonalOffer(database, "customer-2", "murmur_pro_in_offer:monthly");
    expect(rows.get("customer-2")?.redeemed).toBe(1);
  });

  it("does not start when the flag is disabled", () => {
    const { database, rows } = offerDatabase();
    queuePersonalOfferStart({
      config: defaultServerConfig({}),
      customerId: "customer-1",
      database,
      nowMs: 1_000,
    });
    expect(rows.size).toBe(0);
  });

  it("reports a D1 failure without waiting for it", async () => {
    let rejectWrite = (_failure: Error): void => {};
    const pendingWrite = new Promise<never>((_resolve, reject) => { rejectWrite = reject; });
    const database = {
      prepare: vi.fn(() => ({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn(),
        run: vi.fn(() => pendingWrite),
      })),
    };
    const background: Promise<unknown>[] = [];
    queuePersonalOfferStart({
      config: { ...defaultServerConfig({}), personal_offer_enabled: true },
      context: { waitUntil: (promise) => { background.push(promise); } },
      customerId: "customer-1",
      database,
      nowMs: 1_000,
    });
    expect(background).toHaveLength(1);
    expect(sentry.captureException).not.toHaveBeenCalled();
    rejectWrite(new Error("D1 unavailable"));
    await Promise.all(background);
    expect(sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
      tags: { operation: "start_personal_offer" },
    });
  });
});
