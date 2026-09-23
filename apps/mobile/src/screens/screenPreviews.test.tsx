import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const seen = vi.hoisted(() => ({ screens: [] as string[] }));

vi.mock("./account/accountScreen", () => ({ AccountScreen: () => { seen.screens.push("account"); return null; } }));
vi.mock("./auth/signInScreen", () => ({
  SignInScreen: (props: { planId?: string }) => { seen.screens.push(`sign-in:${props.planId}`); return null; },
}));
vi.mock("./plans/plansScreen", () => ({
  PlansScreen: (props: { initialTerm?: string }) => { seen.screens.push(`plans:${props.initialTerm}`); return null; },
}));
vi.mock("./settings/settingsScreen", () => ({ SettingsScreen: () => { seen.screens.push("settings"); return null; } }));
vi.mock("../lib/billing/context", () => ({
  MurmurBillingFixtureProvider: ({ children }: { children: ReactNode }) => children,
}));

import { screenPreviews } from "./screenPreviews";

describe("screen previews", () => {
  it("renders every screen preview from fixtures", () => {
    for (const render of Object.values(screenPreviews)) {
      renderToStaticMarkup(<>{render()}</>);
    }

    expect(seen.screens).toContain("account");
    expect(seen.screens).toContain("settings");
    expect(seen.screens).toContain("plans:monthly");
    expect(seen.screens).toContain("plans:yearly");
    expect(seen.screens).toContain("plans:pack");
    expect(seen.screens).toContain("sign-in:$rc_annual");
  });
});
