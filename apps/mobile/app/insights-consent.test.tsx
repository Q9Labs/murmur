import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/screens/insights/insightsConsentScreen", () => ({ InsightsConsentScreen: () => <p>insights consent</p> }));

import InsightsConsentRoute from "./insights-consent";

describe("insights consent route", () => {
  it("renders the insights consent screen", () => {
    expect(renderToStaticMarkup(<InsightsConsentRoute />)).toContain("insights consent");
  });
});
