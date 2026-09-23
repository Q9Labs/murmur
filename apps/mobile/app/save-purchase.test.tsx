import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/screens/auth/savePurchaseScreen", () => ({ SavePurchaseScreen: () => <p>save purchase</p> }));

import SavePurchaseRoute from "./save-purchase";

describe("save purchase route", () => {
  it("renders the save purchase screen", () => {
    expect(renderToStaticMarkup(<SavePurchaseRoute />)).toContain("save purchase");
  });
});
