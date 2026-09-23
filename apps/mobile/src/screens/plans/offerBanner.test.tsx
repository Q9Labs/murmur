import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => import("../__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));

import { formatCountdown, OfferBanner, remainingOfferMs, spokenCountdown } from "./offerBanner";

afterEach(() => {
  vi.useRealTimers();
});

describe("personal offer banner", () => {
  it("counts down in hours, minutes and seconds past a day", () => {
    expect(formatCountdown(47 * 3_600_000 + 5 * 60_000 + 9_400)).toBe("47:05:09");
    expect(formatCountdown(0)).toBe("00:00:00");
    expect(remainingOfferMs(null, 5)).toBe(0);
    expect(remainingOfferMs(10, 20)).toBe(0);
    expect(remainingOfferMs(20, 5)).toBe(15);
  });

  it("speaks the time left without seconds", () => {
    expect(spokenCountdown(47 * 3_600_000 + 5 * 60_000)).toBe("47 hours 5 minutes");
    expect(spokenCountdown(3_600_000)).toBe("1 hour");
    expect(spokenCountdown(30_000)).toBe("1 minute");
  });

  it("shows the discount and the live time left to the real expiry", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-23T10:00:00.000Z"));
    const markup = renderToStaticMarkup(
      <OfferBanner discountPercent={20} expiresAtMs={Date.parse("2026-09-25T09:30:15.000Z")} />,
    );

    expect(markup).toContain("20% off Pro");
    expect(markup).toContain("Ends in 47:30:15");
  });

  it("hides without an offer, without offer prices, or once the offer has ended", () => {
    expect(renderToStaticMarkup(<OfferBanner discountPercent={20} expiresAtMs={null} />)).toBe("");
    expect(renderToStaticMarkup(<OfferBanner discountPercent={null} expiresAtMs={Date.now() + 60_000} />)).toBe("");
    expect(renderToStaticMarkup(<OfferBanner discountPercent={20} expiresAtMs={Date.now() - 1} />)).toBe("");
  });
});
