export type StorageFailureDiagnostics = {
  storage_scope: "rating_state" | "install_identity" | "free_allowance_identity" | "auth_cookie" | "auth_session" | "other";
  storage_step: "read_sync" | "read_async" | "write_sync" | "write_async" | "delete_async";
  storage_failure: "interaction_not_allowed" | "not_available" | "authentication_failed" | "decode_failed" | "invalid_parameter" | "duplicate_item" | "keychain_other" | "other";
  storage_app_state: "active" | "background" | "inactive" | "unknown";
};

const failures = new WeakMap<object, StorageFailureDiagnostics>();

export function recordStorageFailure(failure: unknown, context: {
  key: string;
  step: StorageFailureDiagnostics["storage_step"];
  appState: string | null;
}): void {
  if (!(failure instanceof Error)) return;
  failures.set(failure, {
    storage_scope: storageScope(context.key),
    storage_step: context.step,
    storage_failure: classifyFailure(failure),
    storage_app_state: context.appState === "active" || context.appState === "background" || context.appState === "inactive"
      ? context.appState : "unknown",
  });
}

export function getStorageFailureDiagnostics(failure: unknown): StorageFailureDiagnostics | undefined {
  return failure instanceof Error ? failures.get(failure) : undefined;
}

function storageScope(key: string): StorageFailureDiagnostics["storage_scope"] {
  switch (key) {
    case "murmur_rating_state_v2": return "rating_state";
    case "murmur_install_id": return "install_identity";
    case "murmur_free_allowance_id": return "free_allowance_identity";
  }
  if (/^murmur-auth_cookie(?:\.\d+)?$/.test(key)) return "auth_cookie";
  if (/^murmur-auth_session_data(?:\.\d+)?$/.test(key)) return "auth_session";
  return "other";
}

function classifyFailure(failure: Error): StorageFailureDiagnostics["storage_failure"] {
  if (!("code" in failure) || failure.code !== "ERR_KEY_CHAIN") return "other";
  // Expo 57 SecureStoreExceptions.swift reasons; Exception.swift chains them with this separator.
  // Never forward the native message, arbitrary codes, or storage keys to telemetry.
  switch (failure.message.split("\n→ Caused by: ").at(-1)) {
    case "User interaction is not allowed.": return "interaction_not_allowed";
    case "No keychain is available. You may need to restart your computer.": return "not_available";
    case "Authentication failed. Provided passphrase/PIN is incorrect or there is no user authentication method configured for this device.": return "authentication_failed";
    case "Unable to decode the provided data.": return "decode_failed";
    case "One or more parameters passed to a function where not valid.": return "invalid_parameter";
    case "The specified item already exists in the keychain.": return "duplicate_item";
    default: return "keychain_other";
  }
}
