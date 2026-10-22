import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { MurmurBillingContext } from "../lib/billing/context";
import type { HomeExperience } from "./experience";
import { beforeEach, describe, expect, it, vi } from "vitest";

const screen = vi.hoisted(() => ({
  billing: null as MurmurBillingContext | null,
  effects: [] as Array<() => void | (() => void)>,
  slots: [] as unknown[],
  cursor: 0,
  home: null as Parameters<typeof HomeExperience>[0] | null,
  error: null as string | null,
  start: vi.fn(async () => undefined),
  router: { push: vi.fn(), setParams: vi.fn() },
}));
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useEffect: (effect: () => void | (() => void)) => screen.effects.push(effect),
  useState: <T>(initial: T | (() => T)) => {
    const index = screen.cursor++;
    if (!(index in screen.slots)) screen.slots[index] = typeof initial === "function" ? (initial as () => T)() : initial;
    return [screen.slots[index] as T, (value: T | ((previous: T) => T)) => {
      screen.slots[index] = typeof value === "function" ? (value as (previous: T) => T)(screen.slots[index] as T) : value;
    }];
  },
}));
const backHandler = vi.hoisted(() => ({
  addEventListener: vi.fn(() => ({ remove: vi.fn() })),
}));

vi.mock("react-native", () => ({ BackHandler: backHandler }));
vi.mock("expo-constants", () => ({ default: { expoConfig: { version: "test" } } }));
vi.mock("expo-linking", () => ({ useURL: () => null }));
vi.mock("expo-router", () => ({ useLocalSearchParams: () => ({}), useRouter: () => screen.router }));
vi.mock("../screens/rating/ratingSheet", () => ({ RatingSheet: () => null }));
vi.mock("../screens/screenServices", () => ({ useScreenServices: () => ({ features: { phoneAudio: false }, phoneAudioGift: { claimable: false } }) }));
vi.mock("../lib/billing/context", () => ({
  useMurmurBilling: () => screen.billing,
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
  initializeAnonymousAnalytics: vi.fn(async () => true),
  resetAnonymousAnalyticsPreference: vi.fn(async () => undefined),
  updateAnonymousAnalyticsEnabled: vi.fn(async () => undefined),
}));
vi.mock("../lib/useLiveTranslation", () => ({
  useLiveTranslation: vi.fn(() => ({
    cancel: vi.fn(async () => undefined),
    start: screen.start,
    prepare: vi.fn(async () => undefined),
    error: screen.error,
    spans: [],
    status: "idle",
  })),
}));
vi.mock("./audioPlaybackPreference", () => ({
  deleteStoredAudioPlaybackEnabled: vi.fn(async () => undefined),
  getStoredAudioPlaybackEnabled: vi.fn(async () => true),
  setStoredAudioPlaybackEnabled: vi.fn(async () => undefined),
}));
vi.mock("./experience", () => ({ HomeExperience: (props: Parameters<typeof HomeExperience>[0]) => { screen.home = props; return null; } }));
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("__DEV__", true);
  screen.effects.length = 0;
  screen.slots.length = 0;
  screen.cursor = 0;
  screen.home = null;
  screen.error = null;
  screen.billing = fixtureBilling({ freeAllowanceMs: 0, availableMs: 0 });
});

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
  it.each([null, "allowance_exhausted"])("routes the real home Start/exhaustion path to the paywall (%s)", async (error) => {
    screen.error = error;
    screen.cursor = 0;
    renderToStaticMarkup(createElement(HomeScreen));
    const cleanups = screen.effects.splice(0).map((effect) => effect());
    await flushMicrotasks();
    if (!error) {
      screen.cursor = 0;
      renderToStaticMarkup(createElement(HomeScreen));
      expect(screen.home).not.toBeNull();
      screen.home?.onPrimaryAction();
      await flushMicrotasks();
    }
    expect(screen.router.push).toHaveBeenCalledWith("/paywall");
    expect(screen.start).not.toHaveBeenCalled();
    cleanups.forEach((cleanup) => cleanup?.());
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

  it("leaves an unknown customer or a failed refresh to Worker enforcement", async () => {
    for (const customer of [null, { ...fixtureCustomer, freeAllowanceMs: 0 }]) {
      const start = vi.fn(async () => undefined);
      const openPlans = vi.fn();
      await startWithAllowance({ customer, refresh: async () => null, start, openPlans });
      expect(start).toHaveBeenCalledOnce();
      expect(openPlans).not.toHaveBeenCalled();
    }
  });
});
