import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/screens/history/historyScreen", () => ({ HistoryScreen: () => <p>history</p> }));

import HistoryRoute from "./index";

describe("history route", () => {
  it("renders the history screen", () => {
    expect(renderToStaticMarkup(<HistoryRoute />)).toContain("history");
  });
});
