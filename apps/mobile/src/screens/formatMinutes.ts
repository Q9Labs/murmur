import { formatUiNumber, type UiText } from "../i18n/runtime";

export function formatMinutes(milliseconds: number, ui: UiText): string {
  const minutes = Math.max(0, Math.ceil(milliseconds / 60_000));
  if (minutes < 60) {
    return ui.t("duration.minutes", { minutes: formatUiNumber(minutes, ui.locale) });
  }
  const hours = formatUiNumber(Math.floor(minutes / 60), ui.locale, { grouping: true });
  const remainder = minutes % 60;
  return remainder
    ? ui.t("duration.hoursMinutes", { hours, minutes: formatUiNumber(remainder, ui.locale) })
    : ui.t("duration.hours", { hours });
}
