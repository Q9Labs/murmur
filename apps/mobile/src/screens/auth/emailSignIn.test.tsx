import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MurmurBillingContext } from "../../lib/billing/context";
import { fixtureBilling } from "../__tests__/billingFixture";
import { findControl, recorded, resetRecorded } from "../__tests__/reactNativePrimitives";

vi.mock("react-native", () => import("../__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));
vi.mock("lucide-react-native", () => ({ Check: () => null }));

import { EmailSignInView, emailSignInTitle, useEmailSignIn } from "./emailSignIn";
import { codeStep, type EmailSignInState } from "./emailSignInState";

const handlers = {
  onChangeEmail: vi.fn(),
  onCodeChange: vi.fn(),
  onEmailChange: vi.fn(),
  onResend: vi.fn(),
  onSendCode: vi.fn(),
  onVerify: vi.fn(),
};
const done = { label: "Done", onPress: vi.fn() };

function renderView(state: EmailSignInState, doneAction = done): string {
  return renderToStaticMarkup(<EmailSignInView doneAction={doneAction} handlers={handlers} state={state} />);
}

function Flow(props: { billing: MurmurBillingContext; initialState: EmailSignInState }): ReactNode {
  const flow = useEmailSignIn(props.billing, props.initialState);
  return <EmailSignInView doneAction={done} handlers={flow.handlers} state={flow.state} />;
}

function primaryButton() {
  return recorded.controls.find(
    (control) => control.accessibilityRole === "button" && control.accessibilityLabel === undefined,
  );
}

beforeEach(() => {
  resetRecorded();
  vi.clearAllMocks();
});

describe("email sign-in screens", () => {
  it("titles each step", () => {
    expect(emailSignInTitle({ email: "", error: null, pending: false, step: "email" })).toBe("Sign in");
    expect(emailSignInTitle(codeStep("a@b.co"))).toBe("Enter the code");
    expect(emailSignInTitle({ email: "a@b.co", step: "done" })).toBe("You're signed in");
  });

  it("asks for an email, then shows sending and invalid-email states", () => {
    expect(renderView({ email: "", error: null, pending: false, step: "email" })).toContain("Email me a code");
    expect(recorded.inputs[0]?.accessibilityLabel).toBe("Email address");

    resetRecorded();
    expect(renderView({ email: "maya@example.com", error: null, pending: true, step: "email" })).toContain("Sending…");
    expect(recorded.inputs[0]?.editable).toBe(false);

    expect(renderView({ email: "maya@", error: "Enter a valid email address.", pending: false, step: "email" }))
      .toContain("Enter a valid email address.");
  });

  it("asks for the code with resend and change-email links", () => {
    const markup = renderView(codeStep("maya@example.com", "We sent a new code."));

    expect(markup).toContain("maya@example.com");
    expect(markup).toContain("We sent a new code.");
    expect(findControl("Send a new code")).toBeDefined();
    expect(findControl("Change email")).toBeDefined();
  });

  it("shows signing-in, resending and wrong-code states", () => {
    expect(renderView({ ...codeStep("maya@example.com"), code: "123456", pending: "verify" })).toContain("Signing in…");
    expect(renderView({ ...codeStep("maya@example.com"), pending: "resend" })).toContain("Sending…");
    expect(renderView({ ...codeStep("maya@example.com"), error: "That code did not match." }))
      .toContain("That code did not match.");
  });

  it("confirms the sign-in and offers the next step", () => {
    const onPress = vi.fn();
    const markup = renderView({ email: "maya@example.com", step: "done" }, { label: "Subscribe for $99.99 / year", onPress });

    expect(markup).toContain("maya@example.com");
    expect(markup).toContain("Subscribe for $99.99 / year");
    primaryButton()?.onPress?.();
    expect(onPress).toHaveBeenCalledOnce();
  });
});

describe("email sign-in flow", () => {
  it("sends a code to the normalized email", () => {
    const billing = fixtureBilling();
    renderToStaticMarkup(
      <Flow billing={billing} initialState={{ email: " Maya@Example.com ", error: null, pending: false, step: "email" }} />,
    );

    primaryButton()?.onPress?.();
    expect(billing.sendSignInCode).toHaveBeenCalledWith("maya@example.com");
  });

  it("does not send a code for an implausible email", () => {
    const billing = fixtureBilling();
    renderToStaticMarkup(
      <Flow billing={billing} initialState={{ email: "maya@", error: null, pending: false, step: "email" }} />,
    );

    primaryButton()?.onPress?.();
    expect(billing.sendSignInCode).not.toHaveBeenCalled();
  });

  it("verifies a complete code and sends a new one on request", () => {
    const billing = fixtureBilling();
    renderToStaticMarkup(<Flow billing={billing} initialState={{ ...codeStep("maya@example.com"), code: "482913" }} />);

    findControl("Send a new code")?.onPress?.();
    primaryButton()?.onPress?.();
    expect(billing.sendSignInCode).toHaveBeenCalledWith("maya@example.com");
    expect(billing.verifySignInCode).toHaveBeenCalledWith("maya@example.com", "482913");
  });
});
