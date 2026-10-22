import { parseMobileTelemetryEvent } from "@murmur/protocol/telemetry";
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ loadMurmurPlans: vi.fn() }));

vi.mock("./revenueCat", () => store);

import { loadPlansWithTelemetry } from "./planLoading";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loading plans", () => {
  it("records the paywall opening before waiting on the store", async () => {
    const report = vi.fn();
    let resolveStore: (plans: never[]) => void = () => undefined;
    store.loadMurmurPlans.mockReturnValue(new Promise((resolve) => {
      resolveStore = resolve;
    }));

    const pending = loadPlansWithTelemetry("launch", report);
    expect(report).toHaveBeenCalledWith("mobile_paywall_opened", { packageLabel: "plan_picker" });
    await vi.waitFor(() => expect(store.loadMurmurPlans).toHaveBeenCalledWith("launch"));
    resolveStore([]);
    await expect(pending).resolves.toEqual([]);
    expect(report).toHaveBeenCalledOnce();
  });

  it("labels hard-paywall loads separately from Plans", async () => {
    const report = vi.fn();
    store.loadMurmurPlans.mockResolvedValue([]);
    await loadPlansWithTelemetry(null, report, "hard_paywall");
    expect(report).toHaveBeenCalledWith("mobile_paywall_opened", { packageLabel: "hard_paywall" });
    expect(parseMobileTelemetryEvent({ event: "mobile_paywall_opened", package_label: "hard_paywall", app_version: "1.0", build_number: "1", backend_environment: "sandbox", platform: "ios", result_category: null })).not.toBeNull();
  });

  it.each(["hard_paywall", undefined] as const)("labels a failed plan load with its surface (%s)", async (surface) => {
    const report = vi.fn();
    store.loadMurmurPlans.mockRejectedValue(new Error("store down"));

    await expect(loadPlansWithTelemetry(null, report, surface)).rejects.toThrow("store down");
    expect(report).toHaveBeenLastCalledWith("mobile_paywall_failed", { packageLabel: surface ?? "plan_picker", resultCategory: "store_error" });
  });
});
