import { describe, expect, it, vi } from "vitest";

vi.mock("expo-constants", () => ({ default: { expoConfig: { version: "1.2.3" } } }));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));

import { getAppRelease } from "./appRelease";

describe("app release identity", () => {
  it("reports the platform and store version the worker gates on", () => {
    expect(getAppRelease()).toEqual({ app_platform: "android", app_version: "1.2.3" });
  });
});
