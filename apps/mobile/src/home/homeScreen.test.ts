import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-constants", () => ({ default: { expoConfig: { version: "test" } } }));
vi.mock("expo-linking", () => ({ useURL: () => null }));
vi.mock("expo-network", () => ({
  addNetworkStateListener: () => ({ remove: vi.fn() }),
  getNetworkStateAsync: vi.fn(async () => ({ type: "wifi" })),
}));
vi.mock("../../modules/murmur-audio", () => ({
  default: {
    addListener: () => ({ remove: vi.fn() }),
    getAudioState: vi.fn(async () => ({
      audio_generation_id: 0,
      capture_active: false,
      event_seq: 0,
      playback_active: false,
      playback_queued_ms: 0,
    })),
  },
}));
vi.mock("../lib/acquisition", () => ({ getAcquisitionContextFromUrl: () => undefined }));
vi.mock("../lib/engagement", () => ({
  deleteEngagementState: vi.fn(async () => undefined),
  markReviewRequested: vi.fn(async () => undefined),
  recordSessionOutcome: vi.fn(async () => ({ should_request_review: false })),
}));
vi.mock("../lib/installIdentity", () => ({
  acknowledgePrivacyDisclosure: vi.fn(async () => undefined),
  deleteLocalMurmurData: vi.fn(async () => undefined),
  hasAcknowledgedPrivacyDisclosure: vi.fn(async () => false),
  resetInstallId: vi.fn(async () => undefined),
}));
vi.mock("../lib/requestReview", () => ({ requestMurmurReview: vi.fn(async () => false) }));
vi.mock("../lib/shareMurmur", () => ({ shareMurmur: vi.fn(async () => undefined) }));
vi.mock("../lib/useLiveTranslation", () => ({
  useLiveTranslation: vi.fn(() => ({
    cancel: vi.fn(async () => undefined),
    start: vi.fn(async () => undefined),
    status: "idle",
  })),
}));
vi.mock("./audioPlaybackPreference", () => ({
  deleteStoredAudioPlaybackEnabled: vi.fn(async () => undefined),
  getStoredAudioPlaybackEnabled: vi.fn(async () => true),
  setStoredAudioPlaybackEnabled: vi.fn(async () => undefined),
}));
vi.mock("./experience", () => ({ HomeExperience: () => null }));
vi.mock("./onboardingScreen", () => ({ OnboardingScreen: () => null }));
vi.mock("./variants/preference", () => ({ deleteStoredUiVariant: vi.fn(async () => undefined) }));
vi.mock("./viewModel", () => ({
  buildHomeViewModel: () => ({
    canStart: true,
    isLive: false,
    latestProviderRoute: null,
    sourceLanguageDisplayName: "English",
    targetLanguage: { display_name: "Arabic" },
  }),
}));

import { createAudioPlaybackPreferenceController } from "./homeScreen";

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
    expect(messages).toEqual([null, null, "Local Murmur data deleted. Privacy acknowledgement, install id, and rating eligibility were cleared."]);

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
