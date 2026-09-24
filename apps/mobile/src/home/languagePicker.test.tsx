import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  recorded,
  resetRecorded,
  setTestPlatformOS,
} from "../screens/__tests__/reactNativePrimitives";

vi.mock("react-native", () =>
  import("../screens/__tests__/reactNativePrimitives").then((module) => module.reactNativePrimitives),
);
vi.mock("../lib/billing/context", () => ({
  useMurmurBilling: () => ({ config: { enabledLanguages: null } }),
}));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => children ?? null,
}));
vi.mock("lucide-react-native", () => ({ X: () => null }));

import { LanguagePickerController } from "./languagePicker";

beforeEach(() => {
  resetRecorded();
  setTestPlatformOS("android");
});

describe("language picker keyboard layout", () => {
  it("lets search results shrink above the keyboard without dismissing it on taps", () => {
    renderToStaticMarkup(
      <LanguagePickerController
        mode="source"
        onClose={vi.fn()}
        setSourceLanguageCode={vi.fn()}
        setTargetLanguageCode={vi.fn()}
        sourceLanguageCode="en"
        targetLanguageCode="ar"
      />,
    );

    expect(recorded.scrollViews).toHaveLength(1);
    expect(recorded.scrollViews[0]).toMatchObject({
      keyboardDismissMode: "interactive",
      keyboardShouldPersistTaps: "handled",
      style: { flexShrink: 1 },
    });
    expect(recorded.keyboardAvoidingViews).toContainEqual({ behavior: "height" });
  });
});
