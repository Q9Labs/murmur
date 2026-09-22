import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  billingProps: null as Record<string, unknown> | null,
  onboardingProps: null as Record<string, unknown> | null,
  outOfMinutesProps: null as Record<string, unknown> | null,
  pickerProps: null as Record<string, unknown> | null,
  settingsProps: null as Record<string, unknown> | null,
  shellProps: null as Record<string, unknown> | null,
  updateRequiredProps: null as Record<string, unknown> | null,
}));

vi.mock("./accountBillingModal", () => ({
  AccountBillingModal: (props: Record<string, unknown>) => {
    harness.billingProps = props;
    return null;
  },
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

vi.mock("./settingsModals", () => ({
  SettingsModal: (props: Record<string, unknown>) => {
    harness.settingsProps = props;
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

import { BloomPreview } from "./preview";

describe("Bloom preview", () => {
  it("renders billing with a stable free-allowance fixture", () => {
    renderToStaticMarkup(<BloomPreview screen="billing" />);

    expect(harness.billingProps?.["billing"]).toMatchObject({
      busy: false,
      customer: {
        allowanceMs: 300_000,
        availableMs: 300_000,
        plan: "free",
      },
      error: null,
    });
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

  it("opens settings over the translation screen", () => {
    renderToStaticMarkup(<BloomPreview screen="settings" />);

    expect(harness.settingsProps).toMatchObject({
      developerToolsEnabled: false,
      live: { status: "idle" },
      open: true,
      settingsMessage: null,
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

  it("renders the out-of-minutes sheet for an anonymous listener with Pro first", () => {
    renderToStaticMarkup(<BloomPreview screen="out-of-minutes" />);

    expect(harness.outOfMinutesProps).toMatchObject({
      billing: { customer: { availableMs: 0, isRegistered: false } },
      open: true,
      plans: {
        plans: [
          { kind: "pro", price: "$9.99 / month" },
          { kind: "pro", price: "$99.99 / year" },
          { kind: "top_up", price: "$7.99" },
          { kind: "top_up", price: "$29.99" },
        ],
        status: "ready",
      },
      reason: "exhausted",
    });
    expect(harness.shellProps?.["live"]).toMatchObject({ error: "allowance_exhausted" });
  });

  it("renders the out-of-minutes sheet for a signed-in listener", () => {
    renderToStaticMarkup(<BloomPreview screen="out-of-minutes-signed-in" />);

    expect(harness.outOfMinutesProps).toMatchObject({
      billing: { customer: { availableMs: 0, isRegistered: true } },
      reason: "exhausted",
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
});
