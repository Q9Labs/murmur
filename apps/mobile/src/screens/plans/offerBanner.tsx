import { useEffect, useState, type ReactNode } from "react";
import { Text, View } from "react-native";

import { formatUiNumber, useUiLocale, type UiText } from "../../i18n/runtime";
import { usePlanStyles } from "./styles";

export function remainingOfferMs(expiresAtMs: number | null, nowMs: number): number {
  return expiresAtMs === null ? 0 : Math.max(0, expiresAtMs - nowMs);
}

// 47:05:09 — hours keep counting past a day, because the offer lasts 48 hours.
export function formatCountdown(remainingMs: number, ui: UiText): string {
  const totalSeconds = Math.floor(remainingMs / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => formatUiNumber(part, ui.locale, { minimumIntegerDigits: 2 }))
    .join(":");
}

export function spokenCountdown(remainingMs: number, ui: UiText): string {
  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hourText = hours > 0
    ? ui.t(hours === 1 ? "plans.oneHour" : "plans.hours", { count: formatUiNumber(hours, ui.locale) })
    : null;
  const minuteText = minutes > 0 || hours === 0
    ? ui.t(minutes === 1 ? "plans.oneMinute" : "plans.minutes", { count: formatUiNumber(minutes, ui.locale) })
    : null;
  return [hourText, minuteText].filter(Boolean).join(" ");
}

function useNow(active: boolean): number {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!active) {
      return;
    }
    const timer = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [active]);
  return nowMs;
}

// Counts down to the worker's real expiry and disappears when it passes.
export function OfferBanner(props: { discountPercent: number | null; expiresAtMs: number | null }): ReactNode {
  const { styles } = usePlanStyles();
  const ui = useUiLocale();
  const { discountPercent } = props;
  const running = props.expiresAtMs !== null && discountPercent !== null;
  const remainingMs = remainingOfferMs(props.expiresAtMs, useNow(running));
  if (discountPercent === null || !running || remainingMs <= 0) {
    return null;
  }
  const title = ui.t("plans.offerTitle", {
    percent: formatUiNumber(discountPercent / 100, ui.locale, { style: "percent" }),
  });
  return (
    <View
      accessibilityLabel={ui.t("plans.offerSpoken", { countdown: spokenCountdown(remainingMs, ui), title })}
      accessibilityRole="text"
      accessible
      style={styles.offer}
    >
      <Text style={styles.offerTitle}>{title}</Text>
      <Text style={styles.offerCountdown}>{ui.t("plans.offerEnds", { countdown: formatCountdown(remainingMs, ui) })}</Text>
    </View>
  );
}
