import { describe, expect, it, vi } from "vitest";
import { isNativeDevelopmentClient } from "./nativeBuild";

const registry = vi.hoisted((): { launcher: object | null | undefined } => ({ launcher: undefined }));
vi.unmock("./nativeBuild");
vi.mock("react-native", () => ({ NativeModules: {
  get EXDevLauncher() { return registry.launcher; },
  ExpoDevLauncher: { loadApp() {} },
} }));

describe("native installation identity", () => {
  it.each([null, undefined])("does not mistake the modern release stub for a development client (%s)", (launcher) => {
    registry.launcher = launcher;
    expect(isNativeDevelopmentClient()).toBe(false);
  });

  it("detects the native launcher even when it has no loaded manifest", () => {
    registry.launcher = { manifestString: null, manifestURL: null };
    expect(isNativeDevelopmentClient()).toBe(true);
  });
});
