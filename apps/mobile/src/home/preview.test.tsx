import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  onboardingProps: null as Record<string, unknown> | null,
  outOfMinutesProps: null as Record<string, unknown> | null,
  pickerProps: null as Record<string, unknown> | null,
  ratingProps: null as Record<string, unknown> | null,
  screenPreview: null as string | null,
  shellProps: null as Record<string, unknown> | null,
  updateRequiredProps: null as Record<string, unknown> | null,
}));

vi.mock("../i18n/provider", () => ({
  UiLocaleOverride: (props: { children: ReactNode }) => props.children,
}));

vi.mock("./languagePicker", () => ({
  LanguagePickerController: (props: Record<string, unknown>) => {
    harness.pickerProps = props;
    return null;
  },
}));

vi.mock("./outOfMinutesSheet", () => ({
  OutOfMinutesSheet: (props: Record<string, unknown>) => {
    harness.outOfMinutesProps = props;
    return null;
  },
}));

vi.mock("./updateRequiredSheet", () => ({
  UpdateRequiredSheet: (props: Record<string, unknown>) => {
    harness.updateRequiredProps = props;
    return null;
  },
}));

vi.mock("../screens/rating/ratingSheet", () => ({
  RatingSheet: (props: Record<string, unknown>) => {
    harness.ratingProps = props;
    return null;
  },
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

vi.mock("../screens/screenPreviews", () => ({
  screenPreviews: Object.fromEntries(
    [
      "account-guest",
      "account-signed-in",
      "auth-code",
      "auth-code-error",
      "auth-code-expired",
      "auth-email",
      "auth-email-error",
      "auth-sending",
      "auth-success",
      "auth-verifying",
      "plans-monthly",
      "plans-packs",
      "plans-yearly",
      "settings",
      "account-pack",
      "account-pro-max",
      "account-unsaved",
      "history",
      "history-detail",
      "history-empty",
      "history-gate",
      "insights-consent",
      "phone-audio-claimed",
      "phone-audio-gate",
      "phone-audio-gift",
      "plans-offer",
      "save-purchase",
      "save-purchase-saved",
    ].map((screen) => [
      screen,
      () => {
        harness.screenPreview = screen;
        return null;
      },
    ]),
  ),
}));

import { BloomPreview } from "./preview";

describe("Bloom preview", () => {
  it.each([
    "account-guest",
    "account-signed-in",
    "auth-code",
    "auth-code-error",
    "auth-email",
    "auth-success",
    "plans-monthly",
    "plans-packs",
    "plans-yearly",
    "settings",
    "account-pack",
    "account-pro-max",
    "account-unsaved",
    "history",
    "history-detail",
    "history-empty",
    "history-gate",
    "insights-consent",
    "phone-audio-claimed",
    "phone-audio-gate",
    "phone-audio-gift",
    "plans-offer",
    "save-purchase",
    "save-purchase-saved",
  ] as const)("renders the %s screen preview", (screen) => {
    renderToStaticMarkup(<BloomPreview screen={screen} />);

    expect(harness.screenPreview).toBe(screen);
  });

  it("keeps the old billing link pointing at the guest account screen", () => {
    renderToStaticMarkup(<BloomPreview screen="billing" />);

    expect(harness.screenPreview).toBe("account-guest");
  });

  it("opens the target-language picker over the translation screen", () => {
    renderToStaticMarkup(<BloomPreview screen="picker" />);

    expect(harness.pickerProps).toMatchObject({
      mode: "target",
      sourceLanguageCode: "ar",
      targetLanguageCode: "en",
    });
  });

  it("opens the source-language picker over the translation screen", () => {
    renderToStaticMarkup(<BloomPreview screen="source-picker" />);

    expect(harness.pickerProps).toMatchObject({
      mode: "source",
      sourceLanguageCode: "ar",
      targetLanguageCode: "en",
    });
  });

  it("renders the real welcome flow with stable setup copy", () => {
    renderToStaticMarkup(<BloomPreview screen="welcome" />);

    expect(harness.onboardingProps).toMatchObject({
      sourceLanguage: "Arabic",
      step: "welcome",
      targetLanguage: "English",
    });
  });

  it("renders the privacy onboarding step with consent unchecked", () => {
    renderToStaticMarkup(<BloomPreview screen="privacy" />);

    expect(harness.onboardingProps).toMatchObject({
      privacyConsentChecked: false,
      sourceLanguage: "Arabic",
      step: "privacy",
      targetLanguage: "English",
    });
  });

  it("renders the language setup onboarding step with a start-ready pair", () => {
    renderToStaticMarkup(<BloomPreview screen="languages" />);

    expect(harness.onboardingProps).toMatchObject({
      canStart: true,
      sourceLanguage: "Arabic",
      step: "languages",
      targetLanguage: "English",
    });
  });

  it("renders a committed Arabic-to-English live translation", () => {
    renderToStaticMarkup(<BloomPreview screen="translation" />);

    const live = harness.shellProps?.["live"] as {
      spans: Array<{ source_caption: string; translated_caption: string }>;
      status: string;
    };
    expect(live.status).toBe("live");
    expect(live.spans[0]).toMatchObject({
      source_caption:
        "مرحباً، المدينة تبدو مختلفة عندما تفهم كل صوت. الآن أستطيع متابعة الحديث مباشرة باللغة الإنجليزية.",
      translated_caption:
        "Hello, the city feels different when you understand every voice. Now I can follow the conversation live in English.",
    });
  });

  it("renders the live translation with translated audio disabled", () => {
    renderToStaticMarkup(<BloomPreview screen="translation-muted" />);

    expect(harness.shellProps).toMatchObject({
      audioPlaybackEnabled: false,
    });
  });

  it("renders the translation-only layout without source captions", () => {
    renderToStaticMarkup(<BloomPreview screen="translation-only" />);

    expect(harness.shellProps?.["live"]).toMatchObject({
      source_transcript_enabled: false,
      spans: [{ source_caption: "" }],
    });
  });

  it("renders the out-of-minutes sheet for an anonymous listener", () => {
    renderToStaticMarkup(<BloomPreview screen="out-of-minutes" />);

    expect(harness.outOfMinutesProps).toMatchObject({
      customer: { availableMs: 0, isRegistered: false },
      open: true,
    });
    expect(harness.shellProps?.["live"]).toMatchObject({ error: "allowance_exhausted" });
  });

  it("renders the out-of-minutes sheet for a signed-in listener", () => {
    renderToStaticMarkup(<BloomPreview screen="out-of-minutes-signed-in" />);

    expect(harness.outOfMinutesProps).toMatchObject({
      customer: { availableMs: 0, isRegistered: true },
    });
  });

  it("renders a paid listener with a low balance on an idle stage", () => {
    renderToStaticMarkup(<BloomPreview screen="low-balance" />);

    expect(harness.shellProps?.["live"]).toMatchObject({ status: "idle" });
  });

  it("renders the update-required sheet over the stage", () => {
    renderToStaticMarkup(<BloomPreview screen="update-required" />);

    expect(harness.updateRequiredProps).toMatchObject({ open: true });
    expect(harness.shellProps?.["live"]).toMatchObject({ error: "app_version_unsupported" });
  });

  it("renders the rating sheet empty and answered", () => {
    renderToStaticMarkup(<BloomPreview screen="rating" />);
    expect(harness.ratingProps).toMatchObject({ initialAnswer: undefined, open: true });

    renderToStaticMarkup(<BloomPreview screen="rating-answered" />);
    expect(harness.ratingProps).toMatchObject({ initialAnswer: { stars: 5, use: "other" } });
  });

  it("renders a live session that keeps listening in the background", () => {
    renderToStaticMarkup(<BloomPreview screen="translation-background" />);

    expect(harness.shellProps).toMatchObject({ listeningInBackground: true });
    expect(harness.shellProps?.["live"]).toMatchObject({ status: "live" });
  });
});
