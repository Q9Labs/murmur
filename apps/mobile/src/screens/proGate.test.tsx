import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { router } from "./__tests__/navigation";
import { findControl, resetRecorded } from "./__tests__/reactNativePrimitives";

vi.mock("./screenScaffold", () => import("./__tests__/scaffoldMock"));
vi.mock("expo-router", () => import("./__tests__/navigation").then((m) => m.expoRouterMock));
vi.mock("react-native", () => import("./__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));

import { ProGate } from "./proGate";

const Icon = () => null;

beforeEach(() => {
  resetRecorded();
  vi.clearAllMocks();
});

describe("Pro gate", () => {
  it("sells the feature with its benefits and leads to the Pro plans", () => {
    const markup = renderToStaticMarkup(
      <ProGate
        artwork={1}
        benefits={[{ icon: Icon, text: "Read any conversation later." }, { icon: Icon, text: "Saved on this phone only." }]}
        lead="Pro saves each conversation."
        title="Keep every conversation"
      />,
    );

    expect(markup).toContain("Keep every conversation");
    expect(markup).toContain("Pro saves each conversation.");
    expect(markup.indexOf("Read any conversation later.")).toBeLessThan(markup.indexOf("Saved on this phone only."));
    expect(markup.indexOf("See Pro plans")).toBeLessThan(markup.indexOf("Not now"));
    findControl("See Pro plans")?.onPress?.();
    expect(router.push).toHaveBeenCalledWith({ params: { term: "monthly" }, pathname: "/plans" });
  });

  it("lets the listener decline as easily as going back", () => {
    renderToStaticMarkup(<ProGate artwork={1} benefits={[]} lead="Lead" title="Title" />);

    findControl("Not now")?.onPress?.();
    expect(router.back).toHaveBeenCalledOnce();
  });
});
