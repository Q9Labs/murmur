import { describe, expect, it, vi } from "vitest";

vi.mock("../src/screens/paywall/paywallScreen", () => ({ PaywallScreen: () => null }));
import PaywallRoute from "./paywall";
import { PaywallScreen } from "../src/screens/paywall/paywallScreen";

describe("paywall route", () => {
  it("opens the demo-first purchase screen", () => { expect(PaywallRoute).toBe(PaywallScreen); });
});
