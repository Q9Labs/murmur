import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// cspell:ignore cada ciudad cuando diferente entiendes siente
const harness = vi.hoisted(() => ({
  onboardingProps: null as Record<string, unknown> | null,
  shellProps: null as Record<string, unknown> | null,
}));

vi.mock("./variants/bloom", () => ({
  BloomShell: (props: Record<string, unknown>) => {
    harness.shellProps = props;
    return null;
  },
}));

vi.mock("./variants/bloom/onboarding", () => ({
  BloomOnboarding: (props: Record<string, unknown>) => {
    harness.onboardingProps = props;
    return null;
  },
}));

import { BloomPreview } from "./preview";

describe("Bloom preview", () => {
  it("renders the real welcome flow with stable setup copy", () => {
    renderToStaticMarkup(<BloomPreview screen="welcome" />);

    expect(harness.onboardingProps).toMatchObject({
      sourceLanguage: "English",
      step: "welcome",
      targetLanguage: "Spanish",
    });
  });

  it("renders a committed English-to-Spanish live translation", () => {
    renderToStaticMarkup(<BloomPreview screen="translation" />);

    const live = harness.shellProps?.["live"] as {
      spans: Array<{ source_caption: string; translated_caption: string }>;
      status: string;
    };
    expect(live.status).toBe("live");
    expect(live.spans[0]).toMatchObject({
      source_caption: "The city feels different when you understand every voice.",
      translated_caption: "La ciudad se siente diferente cuando entiendes cada voz.",
    });
  });
});
