import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/screens/settings/languageScreen", () => ({ LanguageScreen: () => <p>language screen</p> }));

import LanguageRoute from "./language";

describe("language route", () => {
  it("renders the app language screen", () => {
    expect(renderToStaticMarkup(<LanguageRoute />)).toContain("language screen");
  });
});
