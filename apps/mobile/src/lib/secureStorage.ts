import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";

import { recordStorageFailure, type StorageFailureDiagnostics } from "./storageDiagnostics";

// Storage failures are re-thrown as this typed error with a safe, readable
// generic message: raw native text (Keychain/FunctionCallException internals)
// must never reach UI copy, even after a later message-only rewrap such as
// better-auth's result.error envelope. The step stays in the structured
// diagnostics recorded on the wrapper, so identity-based handling still
// localizes it and classification keeps the original signature.
export class SecureStorageFailure extends Error {
  constructor(step: StorageFailureDiagnostics["storage_step"]) {
    super("Murmur couldn't access saved data. Try again.");
    this.name = "SecureStorageFailure";
    this.step = step;
  }

  readonly step: StorageFailureDiagnostics["storage_step"];
}

function wrap(key: string, step: StorageFailureDiagnostics["storage_step"], failure: unknown): never {
  const wrapped = new SecureStorageFailure(step);
  recordStorageFailure(wrapped, { key, step, appState: AppState.currentState }, failure);
  throw wrapped;
}

function observe<T>(key: string, step: StorageFailureDiagnostics["storage_step"], operation: () => T): T {
  try {
    return operation();
  } catch (failure) {
    return wrap(key, step, failure);
  }
}

async function observeAsync<T>(key: string, step: StorageFailureDiagnostics["storage_step"], operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (failure) {
    return wrap(key, step, failure);
  }
}

// Keep Expo's arguments and defaults intact, including existing keychain services and accessibility.
export const secureStorage = {
  getItem: (...args: Parameters<typeof SecureStore.getItem>) =>
    observe(args[0], "read_sync", () => SecureStore.getItem(...args)),
  getItemAsync: (...args: Parameters<typeof SecureStore.getItemAsync>) =>
    observeAsync(args[0], "read_async", () => SecureStore.getItemAsync(...args)),
  setItem: (...args: Parameters<typeof SecureStore.setItem>) =>
    observe(args[0], "write_sync", () => SecureStore.setItem(...args)),
  setItemAsync: (...args: Parameters<typeof SecureStore.setItemAsync>) =>
    observeAsync(args[0], "write_async", () => SecureStore.setItemAsync(...args)),
  deleteItemAsync: (...args: Parameters<typeof SecureStore.deleteItemAsync>) =>
    observeAsync(args[0], "delete_async", () => SecureStore.deleteItemAsync(...args)),
};
