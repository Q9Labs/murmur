// @vitest-environment jsdom

import { minimumSessionBalanceMs } from "@murmur/protocol/billing/catalog";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MurmurBillingContext } from "../lib/billing/context";

const state = vi.hoisted(() => ({
  billing: null as MurmurBillingContext | null,
  push: vi.fn(),
  experience: vi.fn((_props: { onPrimaryAction: () => void; outOfMinutesOpen: boolean; onCloseOutOfMinutes: () => void; updateRequiredOpen: boolean; onCloseUpdateRequired: () => void }) => null),
  live: {
    cancel: vi.fn(async () => undefined),
    start: vi.fn(async () => undefined),
    prepare: vi.fn(async () => undefined),
    error: null as string | null,
    spans: [],
    status: "idle",
  },
}));

const backHandler = vi.hoisted(() => ({
  addEventListener: vi.fn(() => ({ remove: vi.fn() })),
}));

vi.mock("react-native", async () => ({
  ...(await import("../screens/__tests__/reactNativePrimitives")).reactNativePrimitives,
  BackHandler: backHandler,
}));
vi.mock("expo-constants", () => ({ default: { expoConfig: { version: "test" } } }));
vi.mock("expo-linking", () => ({ useURL: () => null }));
vi.mock("expo-router", () => ({ useLocalSearchParams: () => ({}), useRouter: () => state }));
vi.mock("../screens/rating/ratingSheet", () => ({ RatingSheet: () => null }));
vi.mock("../screens/screenServices", () => ({ useScreenServices: () => ({ phoneAudioGift: { claimable: false }, insightsConsent: null, features: { phoneAudio: false } }) }));
vi.mock("../lib/billing/context", () => ({
  useMurmurBilling: () => state.billing,
}));
vi.mock("../screens/settings/settingsControls", () => ({ usePublishSettingsControls: vi.fn() }));
vi.mock("expo-network", () => ({
  addNetworkStateListener: () => ({ remove: vi.fn() }),
  getNetworkStateAsync: vi.fn(async () => ({ type: "wifi" })),
}));
vi.mock("../../modules/murmur-audio", () => ({
  default: {
    addListener: () => ({ remove: vi.fn() }),
    getCaptureCapabilities: vi.fn(async () => ({
      device_playback_supported: true,
      floating_overlay_supported: true,
      microphone_supported: true,
      overlay_permission_granted: false,
    })),
    getAudioState: vi.fn(async () => ({
      audio_generation_id: 0,
      capture_active: false,
      event_seq: 0,
      playback_active: false,
      playback_queued_ms: 0,
    })),
    requestOverlayPermission: vi.fn(async () => true),
  },
}));
vi.mock("../lib/acquisition", () => ({ getAcquisitionContextFromUrl: () => undefined }));
vi.mock("../lib/engagement", () => ({
  deleteEngagementState: vi.fn(async () => undefined),
  markReviewRequested: vi.fn(async () => undefined),
  recordSessionOutcome: vi.fn(async () => ({ should_request_review: false })),
}));
vi.mock("../lib/ratings/ratings", () => ({
  claimRatingSlot: vi.fn(async () => false),
  deleteRatingState: vi.fn(async () => undefined),
}));
vi.mock("../lib/phoneAudioGiftOffer", () => ({
  deletePhoneAudioGiftOffer: vi.fn(async () => undefined),
  hasOfferedPhoneAudioGift: vi.fn(async () => true),
  markPhoneAudioGiftOffered: vi.fn(async () => undefined),
}));
vi.mock("../lib/installIdentity", () => ({
  acknowledgePrivacyDisclosure: vi.fn(async () => undefined),
  deleteLocalMurmurData: vi.fn(async () => undefined),
  hasAcknowledgedPrivacyDisclosure: vi.fn(async () => true),
  resetInstallId: vi.fn(async () => undefined),
}));
vi.mock("../lib/observability/sentry", () => ({
  captureMobileFailure: vi.fn(),
  captureMobileFailureCode: vi.fn(),
}));
vi.mock("../lib/requestReview", () => ({ requestMurmurReview: vi.fn(async () => false) }));
vi.mock("../lib/shareMurmur", () => ({ shareMurmur: vi.fn(async () => undefined) }));
vi.mock("../lib/telemetry", () => ({
  captureOnboardingCompleted: vi.fn(),
  captureMobileTelemetry: vi.fn(),
  initializeAnonymousAnalytics: vi.fn(async () => true),
  resetAnonymousAnalyticsPreference: vi.fn(async () => undefined),
  updateAnonymousAnalyticsEnabled: vi.fn(async () => undefined),
}));
vi.mock("../lib/useLiveTranslation", () => ({ useLiveTranslation: () => state.live }));
vi.mock("./audioPlaybackPreference", () => ({
  deleteStoredAudioPlaybackEnabled: vi.fn(async () => undefined),
  getStoredAudioPlaybackEnabled: vi.fn(async () => true),
  setStoredAudioPlaybackEnabled: vi.fn(async () => undefined),
}));
vi.mock("./experience", () => ({ HomeExperience: state.experience }));
vi.mock("./onboardingScreen", () => ({ OnboardingScreen: () => null }));
vi.mock("./variants/preference", () => ({ deleteStoredUiVariant: vi.fn(async () => undefined) }));
vi.mock("./viewModel", () => ({
  buildHomeViewModel: () => ({
    canStart: true,
    isLive: false,
    latestProviderRoute: null,
    sourceLanguageDisplayName: "English",
    targetLanguage: { display_name: "Arabic" },
    targetLanguageDisplayName: "Arabic",
  }),
}));

import { fixtureBilling, fixtureCustomer } from "../screens/__tests__/billingFixture";
import HomeScreen, {
  createAudioPlaybackPreferenceController,
  exhaustionSurface,
  startWithAllowance,
} from "./homeScreen";

type Deferred<T> = {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function createHarness() {
  const enabledChanges: boolean[] = [];
  const messages: Array<string | null> = [];
  const getStored = vi.fn(async () => true);
  const setStored = vi.fn((_enabled: boolean): Promise<void> => Promise.resolve());
  const controller = createAudioPlaybackPreferenceController({
    getStored,
    onEnabledChange: (enabled) => enabledChanges.push(enabled),
    onMessage: (message) => messages.push(message),
    setStored,
  });
  return { controller, enabledChanges, getStored, messages, setStored };
}

const mounted: Root[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("__DEV__", false);
  state.billing = fixtureBilling();
  state.live.error = null;
});
afterEach(async () => {
  await act(async () => {
    for (const root of mounted.splice(0)) root.unmount();
  });
  vi.unstubAllGlobals();
});

async function renderHome(): Promise<Root> {
  const root = createRoot(document.createElement("div"));
  mounted.push(root);
  await act(async () => { root.render(createElement(HomeScreen)); });
  return root;
}

describe("audio playback preference controller", () => {
  it("ignores a stored restore that resolves after a user toggle", async () => {
    const stored = deferred<boolean>();
    const { controller, enabledChanges, getStored } = createHarness();
    getStored.mockReturnValueOnce(stored.promise);

    const restorePromise = controller.restore();
    const writePromise = controller.setEnabled(false);
    stored.resolve(true);

    await Promise.all([restorePromise, writePromise]);

    expect(enabledChanges).toEqual([false]);
  });

  it("serializes writes and ignores an older write failure", async () => {
    const firstWrite = deferred<void>();
    const secondWrite = deferred<void>();
    const { controller, enabledChanges, messages, setStored } = createHarness();
    setStored
      .mockReturnValueOnce(firstWrite.promise)
      .mockReturnValueOnce(secondWrite.promise);

    const firstUpdate = controller.setEnabled(false);
    const secondUpdate = controller.setEnabled(true);
    await flushMicrotasks();

    expect(setStored).toHaveBeenCalledTimes(1);
    firstWrite.reject(new Error("first write failed"));
    await flushMicrotasks();
    expect(setStored).toHaveBeenCalledTimes(2);

    secondWrite.resolve();
    await Promise.all([firstUpdate, secondUpdate]);

    expect(enabledChanges).toEqual([false, true]);
    expect(messages).toEqual([null, null]);
  });

  it("rolls back the latest choice when its write fails", async () => {
    const write = deferred<void>();
    const { controller, enabledChanges, messages, setStored } = createHarness();
    setStored.mockReturnValueOnce(write.promise);

    const update = controller.setEnabled(false);
    write.reject(new Error("write failed"));
    await update;

    expect(enabledChanges).toEqual([false, true]);
    expect(messages).toEqual([null, "Could not save the audio setting. Please try again."]);
  });

  it("keeps delete ahead of later writes and resets persisted state", async () => {
    const firstWrite = deferred<void>();
    const deleteOperation = deferred<void>();
    const secondWrite = deferred<void>();
    const { controller, enabledChanges, messages, setStored } = createHarness();
    setStored
      .mockReturnValueOnce(firstWrite.promise)
      .mockReturnValueOnce(secondWrite.promise);
    const onDeleted = vi.fn();
    const operation = vi.fn(async () => deleteOperation.promise);

    const firstUpdate = controller.setEnabled(false);
    const deletePromise = controller.deleteLocalData(operation, onDeleted);
    await flushMicrotasks();
    expect(operation).not.toHaveBeenCalled();

    firstWrite.resolve();
    await flushMicrotasks();
    expect(operation).toHaveBeenCalledOnce();

    deleteOperation.resolve();
    await deletePromise;
    await firstUpdate;

    expect(onDeleted).toHaveBeenCalledOnce();
    expect(enabledChanges).toEqual([false, true]);
    expect(messages).toEqual([null, null, "Local Murmur data deleted. Privacy acknowledgement, install id, analytics preference, and rating eligibility were cleared."]);

    const latestUpdate = controller.setEnabled(false);
    await flushMicrotasks();
    secondWrite.reject(new Error("latest write failed"));
    await latestUpdate;

    expect(enabledChanges.at(-1)).toBe(true);
  });

  it("handles restore storage failures without rejecting", async () => {
    const { controller, enabledChanges, getStored } = createHarness();
    getStored.mockRejectedValueOnce(new Error("storage unavailable"));

    await expect(controller.restore()).resolves.toBeUndefined();

    expect(enabledChanges).toEqual([]);
  });
});

describe("Start allowance gate", () => {

  it("routes the real home Start action to the paywall without starting translation", async () => {
    state.billing = fixtureBilling({ freeAllowanceMs: 0, availableMs: 0 });
    await renderHome();
    const props = state.experience.mock.calls.at(-1)?.[0];
    await act(async () => { props?.onPrimaryAction(); });
    expect(state.push).toHaveBeenCalledWith("/paywall");
    expect(state.live.start).not.toHaveBeenCalled();
  });

  it("waits for an unknown customer and opens the paywall without starting capture", async () => {
    const pending = deferred<typeof fixtureCustomer | null>();
    const start = vi.fn(async () => undefined);
    const openPlans = vi.fn();
    const refresh = vi.fn(() => pending.promise);
    const starting = startWithAllowance({ customer: null, refresh, start, openPlans });
    expect(refresh).toHaveBeenCalledOnce();
    expect(start).not.toHaveBeenCalled();
    expect(openPlans).not.toHaveBeenCalled();
    pending.resolve({ ...fixtureCustomer, freeAllowanceMs: 0, availableMs: 0 });
    await starting;
    expect(openPlans).toHaveBeenCalledOnce();
    expect(start).not.toHaveBeenCalled();
  });

  it("starts when an unknown customer's refresh fails", async () => {
    const refresh = vi.fn(async () => null);
    const start = vi.fn(async () => undefined);
    const openPlans = vi.fn();
    await startWithAllowance({ customer: null, refresh, start, openPlans });
    expect(refresh).toHaveBeenCalledOnce();
    expect(start).toHaveBeenCalledOnce();
    expect(openPlans).not.toHaveBeenCalled();
  });

  it("starts a known paid customer without refreshing", async () => {
    const customer = { ...fixtureCustomer, freeAllowanceMs: 0, availableMs: 60_000 };
    const refresh = vi.fn(async () => customer);
    const start = vi.fn(async () => undefined);
    const openPlans = vi.fn();
    await startWithAllowance({ customer, refresh, start, openPlans });
    expect(refresh).not.toHaveBeenCalled();
    expect(start).toHaveBeenCalledOnce();
    expect(openPlans).not.toHaveBeenCalled();
  });

  it("opens the paywall without starting translation when hard-mode balance stays empty", async () => {
    const customer = { ...fixtureCustomer, freeAllowanceMs: 0, availableMs: 0 };
    const start = vi.fn(async () => undefined);
    const push = vi.fn();
    const refresh = vi.fn(async () => customer);
    await startWithAllowance({ customer, refresh, start, openPlans: () => push("/paywall") });
    expect(refresh).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith("/paywall");
    expect(start).not.toHaveBeenCalled();
  });

  it("opens the paywall instead of starting with a sub-second hard-mode balance", async () => {
    const customer = { ...fixtureCustomer, freeAllowanceMs: 0, availableMs: minimumSessionBalanceMs - 1 };
    const start = vi.fn(async () => undefined);
    const openPlans = vi.fn();
    const refresh = vi.fn(async () => customer);
    await startWithAllowance({ customer, refresh, start, openPlans });
    expect(refresh).toHaveBeenCalledOnce();
    expect(openPlans).toHaveBeenCalledOnce();
    expect(start).not.toHaveBeenCalled();
  });

  it("keeps freemium Start unchanged even at zero balance", async () => {
    const start = vi.fn(async () => undefined);
    const refresh = vi.fn(async () => fixtureCustomer);
    const openPlans = vi.fn();
    await startWithAllowance({ customer: fixtureCustomer, refresh, start, openPlans });
    expect(refresh).not.toHaveBeenCalled();
    expect(openPlans).not.toHaveBeenCalled();
    expect(start).toHaveBeenCalledOnce();
  });

  it.each([minimumSessionBalanceMs, 7_200_000])("starts when a stale empty cache refreshes to %s ms", async (availableMs) => {
    const customer = { ...fixtureCustomer, freeAllowanceMs: 0, availableMs: 0 };
    const start = vi.fn(async () => undefined);
    const openPlans = vi.fn();
    await startWithAllowance({
      customer, refresh: async () => ({ ...customer, availableMs }), start, openPlans,
    });
    expect(start).toHaveBeenCalledOnce();
    expect(openPlans).not.toHaveBeenCalled();
  });

  it("leaves an unknown or legacy customer to Worker enforcement", async () => {
    for (const customer of [null, { ...fixtureCustomer, freeAllowanceMs: null, availableMs: 0 }]) {
      const start = vi.fn(async () => undefined);
      const openPlans = vi.fn();
      await startWithAllowance({ customer, refresh: async () => null, start, openPlans });
      expect(start).toHaveBeenCalledOnce();
      expect(openPlans).not.toHaveBeenCalled();
    }
  });
});


describe("exhaustionSurface", () => {
  it("routes on the refreshed customer instead of the stale render-time one", () => {
    // A top-up landing between refresh and render must surface nothing.
    expect(exhaustionSurface({ ...fixtureCustomer, freeAllowanceMs: 0, availableMs: 60_000 }))
      .toBe("none");
    // Hard-paywall account with no time goes to the paywall, not the sheet.
    expect(exhaustionSurface({ ...fixtureCustomer, freeAllowanceMs: 0, availableMs: 0 }))
      .toBe("paywall");
    // A freemium account out of minutes still gets the sheet.
    expect(exhaustionSurface({ ...fixtureCustomer, availableMs: 0 })).toBe("out_of_minutes");
  });
});

describe("home billing effects", () => {
  it.each(["freemium", "unknown"])("opens the %s sheet before refresh resolves", async (kind) => {
    const pending = deferred<typeof fixtureCustomer | null>();
    state.billing = {
      ...fixtureBilling({ availableMs: 0 }),
      customer: kind === "unknown" ? null : fixtureBilling({ availableMs: 0 }).customer,
      refresh: vi.fn(() => pending.promise),
    };
    state.live.error = "allowance_exhausted";
    await renderHome();
    expect(state.experience).toHaveBeenLastCalledWith(expect.objectContaining({ outOfMinutesOpen: true }), undefined);
    expect(state.billing.refresh).toHaveBeenCalledOnce();
    expect(state.push).not.toHaveBeenCalled();
    await act(async () => { pending.resolve(fixtureCustomer); });
  });

  it.each([0, 500])("closes the freemium sheet and opens the paywall when refresh returns %s ms in hard mode", async (availableMs) => {
    const pending = deferred<typeof fixtureCustomer | null>();
    state.billing = { ...fixtureBilling({ availableMs: 0 }), refresh: vi.fn(() => pending.promise) };
    state.live.error = "allowance_exhausted";
    await renderHome();
    expect(state.experience).toHaveBeenLastCalledWith(expect.objectContaining({ outOfMinutesOpen: true }), undefined);
    expect(state.push).not.toHaveBeenCalled();
    await act(async () => { pending.resolve({ ...fixtureCustomer, freeAllowanceMs: 0, availableMs }); });
    expect(state.experience).toHaveBeenLastCalledWith(expect.objectContaining({ outOfMinutesOpen: false }), undefined);
    expect(state.push).toHaveBeenCalledExactlyOnceWith("/paywall");
  });

  it("keeps the freemium sheet dismissed when its pending refresh returns no time", async () => {
    const pending = deferred<typeof fixtureCustomer | null>();
    state.billing = { ...fixtureBilling({ availableMs: 0 }), refresh: vi.fn(() => pending.promise) };
    state.live.error = "allowance_exhausted";
    await renderHome();
    expect(state.experience).toHaveBeenLastCalledWith(expect.objectContaining({ outOfMinutesOpen: true }), undefined);
    const props = state.experience.mock.calls.at(-1)?.[0];
    await act(async () => { props?.onCloseOutOfMinutes(); });
    expect(state.experience).toHaveBeenLastCalledWith(expect.objectContaining({ outOfMinutesOpen: false }), undefined);
    await act(async () => { pending.resolve({ ...fixtureCustomer, availableMs: 0 }); });
    expect(state.experience).toHaveBeenLastCalledWith(expect.objectContaining({ outOfMinutesOpen: false }), undefined);
    expect(state.push).not.toHaveBeenCalled();
  });

  it("opens the freemium sheet when a cached hard lock refreshes to freemium", async () => {
    const pending = deferred<typeof fixtureCustomer | null>();
    state.billing = { ...fixtureBilling({ freeAllowanceMs: 0, availableMs: 0 }), refresh: vi.fn(() => pending.promise) };
    state.live.error = "allowance_exhausted";
    await renderHome();
    expect(state.experience).toHaveBeenLastCalledWith(expect.objectContaining({ outOfMinutesOpen: false }), undefined);
    await act(async () => { pending.resolve({ ...fixtureCustomer, availableMs: 0 }); });
    expect(state.experience).toHaveBeenLastCalledWith(expect.objectContaining({ outOfMinutesOpen: true }), undefined);
    expect(state.push).not.toHaveBeenCalled();
  });

  it("does not open Plans when the exhaustion refresh recovers paid minutes", async () => {
    const pending = deferred<typeof fixtureCustomer | null>();
    state.billing = { ...fixtureBilling({ freeAllowanceMs: 0, availableMs: 0 }), refresh: vi.fn(() => pending.promise) };
    state.live.error = "allowance_exhausted";
    const root = await renderHome();
    expect(state.push).not.toHaveBeenCalled();
    const recovered = { ...fixtureCustomer, freeAllowanceMs: 0, availableMs: 60_000 };
    await act(async () => { pending.resolve(recovered); });
    state.billing = fixtureBilling(recovered);
    await act(async () => { root.render(createElement(HomeScreen)); });
    expect(state.push).not.toHaveBeenCalled();
    expect(state.experience).toHaveBeenLastCalledWith(expect.objectContaining({ outOfMinutesOpen: false }), undefined);
  });

  it("keeps a known hard lock when customer refresh fails", async () => {
    const start = vi.fn(async () => undefined);
    const openPlans = vi.fn();
    await startWithAllowance({
      customer: { ...fixtureCustomer, freeAllowanceMs: 0, availableMs: 0 },
      refresh: async () => null, start, openPlans,
    });
    expect(start).not.toHaveBeenCalled();
    expect(openPlans).toHaveBeenCalledOnce();
  });

  it.each([
    ["freemium", "allowance_exhausted"],
    ["freemium", "realtime_allowance_exhausted"],
    ["unknown", "allowance_exhausted"],
  ])("uses the %s sheet after %s when refresh fails", async (kind, error) => {
    const billing = fixtureBilling({ availableMs: 0 });
    state.billing = { ...billing, customer: kind === "unknown" ? null : billing.customer, refresh: vi.fn(async () => null) };
    state.live.error = error;
    await renderHome();
    expect(state.push).not.toHaveBeenCalled();
    expect(state.experience).toHaveBeenLastCalledWith(expect.objectContaining({ outOfMinutesOpen: true }), undefined);
  });

  it("keeps a dismissed update-required sheet closed across customer refreshes", async () => {
    state.live.error = "app_version_unsupported";
    const root = await renderHome();
    expect(state.experience).toHaveBeenLastCalledWith(expect.objectContaining({ updateRequiredOpen: true }), undefined);
    const props = state.experience.mock.calls.at(-1)?.[0];
    await act(async () => { props?.onCloseUpdateRequired(); });
    expect(state.experience).toHaveBeenLastCalledWith(expect.objectContaining({ updateRequiredOpen: false }), undefined);
    state.billing = fixtureBilling({ availableMs: 60_000 });
    await act(async () => { root.render(createElement(HomeScreen)); });
    expect(state.experience).toHaveBeenLastCalledWith(expect.objectContaining({ updateRequiredOpen: false }), undefined);
  });

  it("opens the paywall once for a cached hard lock after exhaustion and failed refresh", async () => {
    state.billing = { ...fixtureBilling({ freeAllowanceMs: 0, availableMs: 0 }), refresh: vi.fn(async () => null) };
    state.live.error = "allowance_exhausted";
    const root = await renderHome();
    await act(async () => { root.render(createElement(HomeScreen)); });
    expect(state.push).toHaveBeenCalledExactlyOnceWith("/paywall");
    expect(state.experience).toHaveBeenLastCalledWith(expect.objectContaining({ outOfMinutesOpen: false }), undefined);
  });

  it("waits for billing before preparing the microphone", async () => {
    state.billing = { ...fixtureBilling(), customer: null, initialized: false };
    const root = await renderHome();
    expect(state.live.prepare).not.toHaveBeenCalled();
    state.billing = fixtureBilling();
    await act(async () => { root.render(createElement(HomeScreen)); });
    expect(state.live.prepare).toHaveBeenCalledOnce();
  });

  it("skips prepare after a failed customer load and prepares once after recovery", async () => {
    state.billing = { ...fixtureBilling(), customer: null, initialized: false };
    const root = await renderHome();
    expect(state.live.prepare).not.toHaveBeenCalled();
    state.billing = { ...state.billing, initialized: true, error: "customer unavailable" };
    await act(async () => { root.render(createElement(HomeScreen)); });
    expect(state.live.prepare).not.toHaveBeenCalled();
    state.billing = { ...state.billing, error: "still unavailable" };
    await act(async () => { root.render(createElement(HomeScreen)); });
    expect(state.live.prepare).not.toHaveBeenCalled();
    state.billing = fixtureBilling();
    await act(async () => { root.render(createElement(HomeScreen)); });
    expect(state.live.prepare).toHaveBeenCalledOnce();
    await act(async () => { root.render(createElement(HomeScreen)); });
    expect(state.live.prepare).toHaveBeenCalledOnce();
  });

  it("does not prepare while hard locked, but prepares when balance arrives", async () => {
    state.billing = fixtureBilling({ freeAllowanceMs: 0, availableMs: 0 });
    const root = await renderHome();
    expect(state.live.prepare).not.toHaveBeenCalled();
    state.billing = fixtureBilling({ freeAllowanceMs: 0, availableMs: 60_000 });
    await act(async () => { root.render(createElement(HomeScreen)); });
    expect(state.live.prepare).toHaveBeenCalledOnce();
  });

  it("does not request the microphone again on same-policy customer refreshes", async () => {
    const root = await renderHome();
    expect(state.live.prepare).toHaveBeenCalledOnce();
    for (const availableMs of [0, 60_000]) {
      state.billing = fixtureBilling({ availableMs });
      await act(async () => { root.render(createElement(HomeScreen)); });
    }
    expect(state.live.prepare).toHaveBeenCalledOnce();
  });

  it("closes the stale sheet when the exhaustion refresh returns a funded customer", async () => {
    const pending = deferred<typeof fixtureCustomer | null>();
    state.billing = { ...fixtureBilling({ availableMs: 0 }), refresh: vi.fn(() => pending.promise) };
    state.live.error = "allowance_exhausted";
    await renderHome();
    // Optimistic open on the stale exhausted customer.
    expect(state.experience).toHaveBeenLastCalledWith(expect.objectContaining({ outOfMinutesOpen: true }), undefined);
    await act(async () => { pending.resolve({ ...fixtureCustomer, availableMs: 60_000 }); });
    // A funded refresh must close that stale sheet instead of leaving it up.
    expect(state.experience).toHaveBeenLastCalledWith(expect.objectContaining({ outOfMinutesOpen: false }), undefined);
    expect(state.push).not.toHaveBeenCalled();
  });

  it("does not reopen a dismissed sheet when a new exhaustion error arrives", async () => {
    const pending = deferred<typeof fixtureCustomer | null>();
    state.billing = { ...fixtureBilling({ availableMs: 0 }), refresh: vi.fn(() => pending.promise) };
    state.live.error = "allowance_exhausted";
    const root = await renderHome();
    const props = state.experience.mock.calls.at(-1)?.[0];
    await act(async () => { props?.onCloseOutOfMinutes(); });
    expect(state.experience).toHaveBeenLastCalledWith(expect.objectContaining({ outOfMinutesOpen: false }), undefined);
    // A different exhaustion error is not a reason to re-nag.
    state.live.error = "realtime_allowance_exhausted";
    await act(async () => { root.render(createElement(HomeScreen)); });
    expect(state.experience).toHaveBeenLastCalledWith(expect.objectContaining({ outOfMinutesOpen: false }), undefined);
    await act(async () => { pending.resolve({ ...fixtureCustomer, availableMs: 0 }); });
    expect(state.experience).toHaveBeenLastCalledWith(expect.objectContaining({ outOfMinutesOpen: false }), undefined);
    expect(state.push).not.toHaveBeenCalled();
  });

  it("never navigates from a refresh resolving after the error cleared", async () => {
    const pending = deferred<typeof fixtureCustomer | null>();
    state.billing = { ...fixtureBilling({ availableMs: 0 }), refresh: vi.fn(() => pending.promise) };
    state.live.error = "allowance_exhausted";
    const root = await renderHome();
    state.live.error = null;
    await act(async () => { root.render(createElement(HomeScreen)); });
    await act(async () => { pending.resolve({ ...fixtureCustomer, freeAllowanceMs: 0, availableMs: 0 }); });
    expect(state.push).not.toHaveBeenCalled();
  });

  it("never navigates from the refresh of a superseded exhaustion error", async () => {
    const staleRefresh = deferred<typeof fixtureCustomer | null>();
    const currentRefresh = deferred<typeof fixtureCustomer | null>();
    const refresh = vi.fn()
      .mockReturnValueOnce(staleRefresh.promise)
      .mockReturnValueOnce(currentRefresh.promise);
    state.billing = { ...fixtureBilling({ availableMs: 0 }), refresh };
    state.live.error = "allowance_exhausted";
    const root = await renderHome();
    // A different exhaustion error supersedes the first and refreshes again.
    state.live.error = "realtime_allowance_exhausted";
    await act(async () => { root.render(createElement(HomeScreen)); });
    expect(refresh).toHaveBeenCalledTimes(2);
    // The obsolete callback resolving to a paywall must not navigate.
    await act(async () => { staleRefresh.resolve({ ...fixtureCustomer, freeAllowanceMs: 0, availableMs: 0 }); });
    expect(state.push).not.toHaveBeenCalled();
    // The current error's own refresh still routes normally.
    await act(async () => { currentRefresh.resolve({ ...fixtureCustomer, freeAllowanceMs: 0, availableMs: 0 }); });
    expect(state.push).toHaveBeenCalledExactlyOnceWith("/paywall");
  });

  it("never navigates when a cleared same-string error revives an obsolete refresh", async () => {
    const obsolete = deferred<typeof fixtureCustomer | null>();
    const current = deferred<typeof fixtureCustomer | null>();
    const refresh = vi.fn()
      .mockReturnValueOnce(obsolete.promise)
      .mockReturnValueOnce(current.promise);
    state.billing = { ...fixtureBilling({ availableMs: 0 }), refresh };
    state.live.error = "allowance_exhausted";
    const root = await renderHome();
    // ABA: the error clears, then the same string returns with a new refresh.
    state.live.error = null;
    await act(async () => { root.render(createElement(HomeScreen)); });
    state.live.error = "allowance_exhausted";
    await act(async () => { root.render(createElement(HomeScreen)); });
    expect(refresh).toHaveBeenCalledTimes(2);
    // The newer cycle resolves funded first: it closes the sheet it opened.
    await act(async () => { current.resolve({ ...fixtureCustomer, availableMs: 60_000 }); });
    expect(state.experience).toHaveBeenLastCalledWith(expect.objectContaining({ outOfMinutesOpen: false }), undefined);
    expect(state.push).not.toHaveBeenCalled();
    // The obsolete same-string refresh resolving to a paywall must not act.
    await act(async () => { obsolete.resolve({ ...fixtureCustomer, freeAllowanceMs: 0, availableMs: 0 }); });
    expect(state.push).not.toHaveBeenCalled();
    expect(state.experience).toHaveBeenLastCalledWith(expect.objectContaining({ outOfMinutesOpen: false }), undefined);
  });

  it("never navigates from a refresh resolving after unmount", async () => {
    const pending = deferred<typeof fixtureCustomer | null>();
    state.billing = { ...fixtureBilling({ availableMs: 0 }), refresh: vi.fn(() => pending.promise) };
    state.live.error = "allowance_exhausted";
    const root = await renderHome();
    await act(async () => { root.unmount(); });
    await act(async () => { pending.resolve({ ...fixtureCustomer, freeAllowanceMs: 0, availableMs: 0 }); });
    expect(state.push).not.toHaveBeenCalled();
  });
});
