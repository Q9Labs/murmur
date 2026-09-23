import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const seen = vi.hoisted(() => ({ planId: undefined as string | undefined }));

vi.mock("expo-router", () => ({ useLocalSearchParams: () => ({ plan: "$rc_annual" }) }));
vi.mock("../src/screens/auth/signInScreen", () => ({
  planIdFromParam: (value: string) => value,
  SignInScreen: (props: { planId?: string }) => {
    seen.planId = props.planId;
    return null;
  },
}));

import SignInRoute from "./sign-in";

describe("sign-in route", () => {
  it("passes the plan being bought to the sign-in screen", () => {
    renderToStaticMarkup(<SignInRoute />);
    expect(seen.planId).toBe("$rc_annual");
  });
});
