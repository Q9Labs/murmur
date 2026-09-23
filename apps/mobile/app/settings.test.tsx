import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/screens/settings/settingsScreen", () => ({ SettingsScreen: () => <p>settings screen</p> }));

import SettingsRoute from "./settings";

describe("settings route", () => {
  it("renders the settings screen", () => {
    expect(renderToStaticMarkup(<SettingsRoute />)).toContain("settings screen");
  });
});
