import { describe, expect, it } from "vitest";

import { failureCopy, LocalizedError } from "./localizedError";
import { recordStorageFailure } from "../lib/storageDiagnostics";
import { createTranslator } from "./runtime";

const en = { locale: "en", t: createTranslator("en") } as const;
const de = { locale: "de", t: createTranslator("de") } as const;

describe("LocalizedError", () => {
  it("keeps an English message for logs and the key for the screen", () => {
    const failure = new LocalizedError("history.languagePair", { source: "English", target: "Arabic" });
    expect(failure.message).toBe("English to Arabic");
    expect(failure.messageKey).toBe("history.languagePair");
  });

  it("renders catalog failures in the UI language", () => {
    const failure = new LocalizedError("auth.sendFailed");
    expect(failureCopy(failure, de, "common.tryAgain")).toBe(de.t("auth.sendFailed"));
  });

  it("shows raw English messages only in English", () => {
    const failure = new Error("Store is down.");
    expect(failureCopy(failure, en, "billing.unavailable")).toBe("Store is down.");
    expect(failureCopy(failure, de, "billing.unavailable")).toBe(de.t("billing.unavailable"));
    expect(failureCopy("boom", en, "billing.unavailable")).toBe(en.t("billing.unavailable"));
  });

  it("falls back for native storage failures instead of leaking internals", () => {
    const failure = new Error("ExpoSecureStore.default.getValueWithKeyAsync is not a function");
    recordStorageFailure(failure, {
      appState: "active",
      key: "murmur_third_party_ai_consent_v4",
      step: "write_async",
    });

    expect(failureCopy(failure, en, "auth.appleFailed")).toBe(en.t("auth.appleFailed"));
    expect(failureCopy(failure, de, "auth.appleFailed")).toBe(de.t("auth.appleFailed"));
  });

  it("still shows unmarked English errors and LocalizedError copy", () => {
    const serverFailure = new Error("User already exists");
    expect(failureCopy(serverFailure, en, "auth.appleFailed")).toBe("User already exists");

    const localized = new LocalizedError("auth.sendFailed");
    recordStorageFailure(new Error("unrelated"), {
      appState: "active",
      key: "murmur_install_id",
      step: "read_async",
    });
    expect(failureCopy(localized, en, "auth.appleFailed")).toBe(en.t("auth.sendFailed"));
  });
});
