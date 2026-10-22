import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";

import { recordStorageFailure, type StorageFailureDiagnostics } from "./storageDiagnostics";

function observe<T>(key: string, step: StorageFailureDiagnostics["storage_step"], operation: () => T): T {
  try {
    return operation();
  } catch (failure) {
    recordStorageFailure(failure, { key, step, appState: AppState.currentState });
    throw failure;
  }
}

async function observeAsync<T>(key: string, step: StorageFailureDiagnostics["storage_step"], operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (failure) {
    recordStorageFailure(failure, { key, step, appState: AppState.currentState });
    throw failure;
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
