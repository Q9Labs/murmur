import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const capturedText: Array<{ children: ReactNode; style: unknown }> = [];

vi.mock("react-native", () => ({
  Pressable: ({ children }: { children?: ReactNode }) => createElement("button", null, children),
  ScrollView: ({ children }: { children?: ReactNode }) => createElement("div", null, children),
  Text: ({ children, style }: { children?: ReactNode; style?: unknown }) => {
    capturedText.push({ children, style });
    return createElement("span", null, children);
  },
  View: ({ children }: { children?: ReactNode }) => createElement("div", null, children),
}));

vi.mock("./diagnostics", () => ({
  copyDiagnosticsReport: vi.fn(),
  downloadDiagnosticsReport: vi.fn(),
  shareLatencyReport: vi.fn(),
}));

vi.mock("./modalSheet", () => ({ ModalSheet: () => null }));
vi.mock("./reportTranslation", () => ({ TranslationReportActions: () => null }));
vi.mock("./styles", () => ({
  styles: {
    latencyLabel: {},
    latencyRow: {},
    latencyValue: {},
  },
}));

import { LatencyRow } from "./diagnosticsModal";

describe("diagnostics locale direction", () => {
  it("renders Arabic latency copy with RTL writing direction", () => {
    renderToStaticMarkup(
      <LatencyRow
        direction="rtl"
        label="أول نص من المصدر"
        value="العدد=٢ / المئين ٥٠: ١٢٠ مللي ثانية"
      />,
    );

    expect(capturedText.find(({ children }) => children === "العدد=٢ / المئين ٥٠: ١٢٠ مللي ثانية")?.style)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ textAlign: "right", writingDirection: "rtl" }),
      ]));
  });
});
