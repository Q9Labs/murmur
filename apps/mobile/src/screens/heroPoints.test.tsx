import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => import("./__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));

import { HeroPoints } from "./heroPoints";

const icon = vi.fn(() => null);

describe("hero points", () => {
  it("lists each point in order, led by its icon", () => {
    const markup = renderToStaticMarkup(
      <HeroPoints points={[{ icon, text: "Saved on this phone only." }, { icon, text: "No password to remember." }]} />,
    );

    expect(markup.indexOf("Saved on this phone only.")).toBeLessThan(markup.indexOf("No password to remember."));
    expect(icon).toHaveBeenCalledTimes(2);
  });
});
