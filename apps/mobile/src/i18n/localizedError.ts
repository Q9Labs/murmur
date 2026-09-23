import { catalogMessage, interpolate } from "./catalogs";
import { enCatalog, type MessageKey } from "./catalogs/en";
import type { InterpolationValues, Translate } from "./runtime";
import type { UiLocale } from "./types";

// A failure the listener sees. Its message stays English for logs and Sentry;
// the screen shows it in the UI language through failureCopy.
export class LocalizedError extends Error {
  readonly messageKey: MessageKey;
  readonly values: InterpolationValues | undefined;

  constructor(messageKey: MessageKey, values?: InterpolationValues) {
    super(interpolate(catalogMessage(enCatalog, messageKey), messageKey, values));
    this.name = "LocalizedError";
    this.messageKey = messageKey;
    this.values = values;
  }
}

// Server and SDK messages only exist in English, so other locales get the fallback line.
export function failureCopy(
  failure: unknown,
  ui: { locale: UiLocale; t: Translate },
  fallback: MessageKey,
): string {
  if (failure instanceof LocalizedError) {
    return ui.t(failure.messageKey, failure.values);
  }
  if (ui.locale === "en" && failure instanceof Error && failure.message.trim()) {
    return failure.message;
  }
  return ui.t(fallback);
}
