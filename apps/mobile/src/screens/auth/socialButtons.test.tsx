import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { findControl, resetRecorded } from "../__tests__/reactNativePrimitives";

vi.mock("react-native", () => import("../__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));
vi.mock("lucide-react-native", () => import("../__tests__/navigation").then((m) => m.lucideMock));
vi.mock("react-native-svg", () => ({ default: () => null, Path: () => null }));

import { AppleSignInButton, EmailSignInButton, GoogleSignInButton } from "./socialButtons";

beforeEach(() => {
  resetRecorded();
});

describe("sign-in buttons", () => {
  it("label each provider and pass presses through", () => {
    const apple = vi.fn();
    const google = vi.fn();
    const email = vi.fn();
    const markup = renderToStaticMarkup(
      <>
        <AppleSignInButton disabled={false} label="Continue with Apple" onPress={apple} />
        <GoogleSignInButton disabled={false} label="Continue with Google" onPress={google} />
        <EmailSignInButton disabled label="Continue with email" onPress={email} />
      </>,
    );

    expect(markup).toContain("Continue with Apple");
    findControl("Continue with Apple")?.onPress?.();
    findControl("Continue with Google")?.onPress?.();
    expect(apple).toHaveBeenCalledOnce();
    expect(google).toHaveBeenCalledOnce();
    expect(findControl("Continue with email")?.accessibilityState?.disabled).toBe(true);
  });
});
