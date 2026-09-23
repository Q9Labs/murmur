import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  type SettingsControls,
  SettingsControlsFixture,
  SettingsControlsProvider,
  useSettingsControls,
} from "./settingsControls";

const controls: SettingsControls = {
  analyticsEnabled: false,
  changeAnalytics: vi.fn(),
  changeInsightsConsent: vi.fn(),
  deleteLocalData: vi.fn(),
  locked: true,
  insightsConsent: null,
  message: null,
  openReport: vi.fn(),
  reportLabel: "Session diagnostics",
  resetIdentity: vi.fn(),
  share: vi.fn(),
};

function Probe(): ReactNode {
  const current = useSettingsControls();
  return current ? current.reportLabel : "none";
}

describe("settings controls bridge", () => {
  it("has no controls until the home screen publishes them", () => {
    expect(renderToStaticMarkup(<SettingsControlsProvider><Probe /></SettingsControlsProvider>)).toBe("none");
  });

  it("serves fixture controls for previews", () => {
    expect(renderToStaticMarkup(
      <SettingsControlsFixture controls={controls}><Probe /></SettingsControlsFixture>,
    )).toBe("Session diagnostics");
  });
});
