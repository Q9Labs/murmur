import { describe, expect, it } from "vitest";

import { getStorageFailureDiagnostics, recordStorageFailure } from "./storageDiagnostics";

describe("storage diagnostic privacy boundary", () => {
  it.each([
    ["User interaction is not allowed.", "interaction_not_allowed"],
    ["No keychain is available. You may need to restart your computer.", "not_available"],
    ["Unable to decode the provided data.", "decode_failed"],
    ["The specified item already exists in the keychain.", "duplicate_item"],
    ["One or more parameters passed to a function where not valid.", "invalid_parameter"],
    ["Authentication failed. Provided passphrase/PIN is incorrect or there is no user authentication method configured for this device.", "authentication_failed"],
    ["private user content", "keychain_other"],
    ["private User interaction is not allowed.", "keychain_other"],
  ])("maps only fixed Expo keychain reasons: %s", (message, expected) => {
    const failure = Object.assign(new Error(message), { code: "ERR_KEY_CHAIN" });
    recordStorageFailure(failure, { key: "private-key", step: "write_async", appState: "private-state" });
    expect(getStorageFailureDiagnostics(failure)).toEqual({
      storage_scope: "other", storage_step: "write_async", storage_failure: expected, storage_app_state: "unknown",
    });
  });

  it("does not infer a keychain cause from an unrelated error or retain arbitrary properties", () => {
    const failure = Object.assign(new Error("User interaction is not allowed."), { code: "private-code", token: "private-token" });
    recordStorageFailure(failure, { key: "private-key", step: "delete_async", appState: null });
    expect(getStorageFailureDiagnostics(failure)).toEqual({
      storage_scope: "other", storage_step: "delete_async", storage_failure: "other", storage_app_state: "unknown",
    });
    expect(getStorageFailureDiagnostics(new Error())).toBeUndefined();
    recordStorageFailure("private thrown string", { key: "private-key", step: "read_async", appState: "active" });
    expect(getStorageFailureDiagnostics("private thrown string")).toBeUndefined();
  });
});
