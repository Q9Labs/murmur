import { vi } from "vitest";

// Node has no native Expo Updates bridge; target tests supply the embedded channel.
vi.mock("expo-updates", () => ({ channel: null }));

// Auth clients initialize during import; give Node tests an explicit isolated target.
process.env.EXPO_PUBLIC_MURMUR_ENV = "development";
process.env.EXPO_PUBLIC_MURMUR_WORKER_URL = "https://murmur-worker-dev.msbilal.workers.dev";
