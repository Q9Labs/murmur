import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const state: { failure: Error | null } = { failure: null };
  return {
    ...state,
    fetch,
    values: new Map<string, string>(),
    failingKey: "",
    failingStep: "read",
    appState: { currentState: "background", addEventListener: vi.fn() },
    captureException: vi.fn(),
    captureMessage: vi.fn(),
  };
});

// Run Expo's real JS validation/bridge; only the unavailable device boundary is substituted.
vi.mock("expo-secure-store", () => import("expo-secure-store/src/SecureStore"));
vi.mock("expo-secure-store/src/ExpoSecureStore", () => {
  const read = (key: string) => {
    if (key === native.failingKey && native.failingStep === "read" && native.failure) throw native.failure;
    return native.values.get(key) ?? null;
  };
  const write = (value: string, key: string) => {
    if (key === native.failingKey && native.failingStep === "write" && native.failure) throw native.failure;
    native.values.set(key, value);
  };
  return { default: {
    getValueWithKeyAsync: async (key: string) => read(key),
    getValueWithKeySync: read,
    setValueWithKeyAsync: async (value: string, key: string) => write(value, key),
    setValueWithKeySync: write,
    deleteValueWithKeyAsync: async (key: string) => { native.values.delete(key); },
  } };
});
vi.mock("react-native", () => ({
  AppState: native.appState,
  Platform: { OS: "ios" },
  PermissionsAndroid: {},
}));
vi.mock("expo", () => ({ requireNativeModule: () => ({}), NativeModule: class {} }));
vi.mock("expo-constants", () => ({ default: { expoConfig: { scheme: "murmur", version: "1.3.1" } } }));
vi.mock("expo-linking", () => ({ createURL: (path: string) => `murmur://${path}` }));
vi.mock("expo-application", () => ({}));
vi.mock("expo-store-review", () => ({ isAvailableAsync: async () => false }));
vi.mock("posthog-react-native", () => ({ default: class {} }));
vi.mock("@sentry/react-native", () => ({
  captureException: native.captureException,
  captureMessage: native.captureMessage,
}));

import { recordCompletedSession } from "./ratings/ratings";
import { closeWorkerSession } from "./live-translation/workerApi";
import { getOrCreateFreeAllowanceId, getOrCreateInstallId } from "./installIdentity";
import { captureMobileFailure, sanitizeMobileEvent } from "./observability/sentry";
import { secureStorage } from "./secureStorage";

const ratingKey = "murmur_rating_state_v2";
const completion = { committed_caption_count: 1, duration_ms: 12_000, error: null };

beforeEach(() => {
  vi.clearAllMocks();
  native.values.clear();
  native.values.set("murmur_install_id", "existing-install");
  native.values.set("murmur_free_allowance_id", "existing-allowance");
  native.values.set("murmur-auth_cookie", JSON.stringify({
    "murmur.session_token": { value: "existing-cookie", expires: null },
  }));
  native.values.set(ratingKey, JSON.stringify({
    completedSessionCount: 4, ratingEligibleSessionCount: 0, successfulSessionCount: 0, storeReviewRequested: false,
  }));
  native.failure = null;
  native.failingKey = "";
  native.failingStep = "read";
  native.fetch.mockImplementation(async () => Response.json({
    session: { id: "test-session", expiresAt: "2099-01-01T00:00:00Z" },
    user: { id: "test-user" },
  }));
  vi.stubGlobal("fetch", native.fetch);
});

afterEach(() => vi.unstubAllGlobals());

function failAt(key: string, step = "read"): Error {
  native.failingKey = key;
  native.failingStep = step;
  native.failure = Object.assign(new Error("Calling the 'getValueWithKeyAsync' function has failed\n→ Caused by: User interaction is not allowed."), { code: "ERR_KEY_CHAIN" });
  return native.failure;
}

async function reportFailure(operation: () => Promise<unknown>, name: string): Promise<void> {
  try {
    await operation();
    throw new Error("expected_storage_failure");
  } catch (failure) {
    expect(failure).toBe(native.failure);
    captureMobileFailure(failure, { operation: name });
  }
}

function expectDiagnostic(scope: string, step: string): void {
  expect(native.captureException).toHaveBeenLastCalledWith(native.failure, expect.objectContaining({
    tags: expect.objectContaining({
      storage_scope: scope,
      storage_step: step,
      storage_failure: "interaction_not_allowed",
      storage_app_state: "background",
    }),
  }));
  const options = native.captureException.mock.lastCall?.[1];
  const event = sanitizeMobileEvent({ ...options, exception: { values: [{ value: native.failure?.message }] } });
  const serialized = JSON.stringify(event);
  expect(serialized).not.toContain(native.failingKey);
  expect(serialized).not.toContain("existing-");
  expect(serialized).not.toContain("User interaction");
}

describe("session-completion storage diagnostics through real handlers and SDKs", () => {
  it.each(["read", "write"])("names the rating %s failure without resetting existing state", async (step) => {
    const before = native.values.get(ratingKey);
    failAt(ratingKey, step);
    await reportFailure(() => recordCompletedSession(completion), "record_completed_session_rating");
    expectDiagnostic("rating_state", `${step}_async`);
    expect(native.values.get(ratingKey)).toBe(before);
    native.failure = null;
    await expect(recordCompletedSession(completion)).resolves.toMatchObject({ askInsightsConsent: false });
    expect(JSON.parse(native.values.get(ratingKey) ?? "null").completedSessionCount).toBe(5);
  });

  it.each([
    ["murmur-auth_cookie", "auth_cookie"],
    ["murmur_free_allowance_id", "free_allowance_identity"],
    ["murmur_install_id", "install_identity"],
  ])("names %s failures before the close POST without replacing identity", async (key, scope) => {
    const before = new Map(native.values);
    failAt(key);
    await reportFailure(() => closeWorkerSession("test-session", "completed"), "close_worker_session");
    expectDiagnostic(scope, "read_async");
    expect(native.values).toEqual(before);
    expect(vi.mocked(fetch).mock.calls.some(([input]) => String(input).endsWith("/stop"))).toBe(false);
    native.failure = null;
    await expect(closeWorkerSession("test-session", "completed")).resolves.toBe("closed");
    expect(native.fetch.mock.calls.some(([input]) => String(input).endsWith("/get-session"))).toBe(true);
    expect(await getOrCreateInstallId()).toBe("existing-install");
    expect(await getOrCreateFreeAllowanceId()).toBe("existing-allowance");
    const stopCall = vi.mocked(fetch).mock.calls.find(([input]) => String(input).endsWith("/stop"));
    expect(new Headers(stopCall?.[1]?.headers).get("cookie")).toContain("existing-cookie");
  });

  it("preserves pre-existing auth records and diagnoses synchronous chunk access", () => {
    const key = "murmur-auth_cookie.0";
    native.values.set(key, "existing-chunk");
    expect(secureStorage.getItem(key)).toBe("existing-chunk");
    failAt(key);
    expect(() => secureStorage.getItem(key)).toThrow(native.failure ?? undefined);
    captureMobileFailure(native.failure, { operation: "read_auth_cookie" });
    expectDiagnostic("auth_cookie", "read_sync");
  });
});
