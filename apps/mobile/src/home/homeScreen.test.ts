import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MurmurBillingContext } from "../lib/billing/context";

const state = vi.hoisted(() => ({
  billing: null as MurmurBillingContext | null,
  push: vi.fn(),
  experience: vi.fn((_props: { outOfMinutesOpen: boolean }) => null),
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

vi.mock("react-native", () => ({ BackHandler: backHandler }));
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
import HomeScreen, { createAudioPlaybackPreferenceController, startWithAllowance } from "./homeScreen";

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

const mounted: ReactTestRenderer[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("__DEV__", false);
  state.billing = fixtureBilling();
  state.live.error = null;
});
afterEach(async () => {
  await act(async () => {
    for (const renderer of mounted.splice(0)) renderer.unmount();
  });
  vi.unstubAllGlobals();
});

async function renderHome(): Promise<ReactTestRenderer> {
  await act(async () => { mounted.push(create(createElement(HomeScreen))); });
  return mounted[mounted.length - 1];
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
  it("opens Plans without starting translation when hard-mode balance stays empty", async () => {
    const customer = { ...fixtureCustomer, freeAllowanceMs: 0, availableMs: 0 };
    const start = vi.fn(async () => undefined);
    const push = vi.fn();
    const refresh = vi.fn(async () => customer);
    await startWithAllowance({ customer, refresh, start, openPlans: () => push("/plans") });
    expect(refresh).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith("/plans");
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

  it.each([1, 7_200_000])("starts when a stale empty cache refreshes to %s ms", async (availableMs) => {
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


describe("home billing effects", () => {
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

  it.each(["allowance_exhausted", "realtime_allowance_exhausted"])(
    "uses cached freemium on a failed refresh after %s", async (error) => {
      state.billing = { ...fixtureBilling({ availableMs: 0 }), refresh: vi.fn(async () => null) };
      state.live.error = error;
      await renderHome();
      expect(state.push).not.toHaveBeenCalled();
      expect(state.experience).toHaveBeenLastCalledWith(expect.objectContaining({ outOfMinutesOpen: true }), undefined);
    },
  );

  it("opens Plans once for a cached hard lock after exhaustion and failed refresh", async () => {
    state.billing = { ...fixtureBilling({ freeAllowanceMs: 0, availableMs: 0 }), refresh: vi.fn(async () => null) };
    state.live.error = "allowance_exhausted";
    const renderer = await renderHome();
    await act(async () => { renderer.update(createElement(HomeScreen)); });
    expect(state.push).toHaveBeenCalledExactlyOnceWith("/plans");
    expect(state.experience).toHaveBeenLastCalledWith(expect.objectContaining({ outOfMinutesOpen: false }), undefined);
  });

  it("waits for billing before preparing the microphone", async () => {
    state.billing = { ...fixtureBilling(), customer: null };
    const renderer = await renderHome();
    expect(state.live.prepare).not.toHaveBeenCalled();
    state.billing = fixtureBilling();
    await act(async () => { renderer.update(createElement(HomeScreen)); });
    expect(state.live.prepare).toHaveBeenCalledOnce();
  });

  it("does not prepare while hard locked, but prepares when balance arrives", async () => {
    state.billing = fixtureBilling({ freeAllowanceMs: 0, availableMs: 0 });
    const renderer = await renderHome();
    expect(state.live.prepare).not.toHaveBeenCalled();
    state.billing = fixtureBilling({ freeAllowanceMs: 0, availableMs: 60_000 });
    await act(async () => { renderer.update(createElement(HomeScreen)); });
    expect(state.live.prepare).toHaveBeenCalledOnce();
  });

});
