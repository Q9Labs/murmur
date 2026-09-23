import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { findControl, reactNativePrimitives, resetRecorded } from "../__tests__/reactNativePrimitives";
import { fixtureServices } from "../__tests__/servicesFixture";

vi.mock("react-native", () => import("../__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));
vi.mock("lucide-react-native", () => import("../__tests__/navigation").then((m) => m.lucideMock));
vi.mock("../../lib/observability/sentry", () => ({ captureMobileFailure: vi.fn() }));
const services = vi.hoisted(() => ({ current: null as ReturnType<typeof fixtureServices> | null }));
vi.mock("../screenServices", () => ({ useScreenServices: () => services.current }));
vi.mock("react-native-svg", () => ({ default: () => null, Path: () => null }));

import { AppleSignInButton, EmailSignInButton, GoogleSignInButton, SocialSignInButtons } from "./socialButtons";

beforeEach(() => {
  resetRecorded();
  services.current = fixtureServices();
  reactNativePrimitives.Platform.OS = "ios";
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

  it("offer Apple wherever Google appears on iOS, and signs in through the services", () => {
    const onError = vi.fn();
    const markup = renderToStaticMarkup(<SocialSignInButtons disabled={false} onError={onError} />);

    expect(markup).toContain("Continue with Apple");
    expect(markup).toContain("Continue with Google");
    findControl("Continue with Apple")?.onPress?.();
    expect(services.current?.signInWithApple).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(null);
  });

  it("offer only Google on Android", () => {
    reactNativePrimitives.Platform.OS = "android";
    const markup = renderToStaticMarkup(<SocialSignInButtons disabled onError={vi.fn()} />);

    expect(markup).not.toContain("Continue with Apple");
    expect(findControl("Continue with Google")?.accessibilityState?.disabled).toBe(true);
  });
});
