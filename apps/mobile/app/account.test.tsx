import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/screens/account/accountScreen", () => ({ AccountScreen: () => <p>account screen</p> }));

import AccountRoute from "./account";

describe("account route", () => {
  it("renders the account screen", () => {
    expect(renderToStaticMarkup(<AccountRoute />)).toContain("account screen");
  });
});
