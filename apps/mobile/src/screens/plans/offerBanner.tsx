import { useEffect, useState, type ReactNode } from "react";
import { Text, View } from "react-native";

import { usePlanStyles } from "./styles";

export function remainingOfferMs(expiresAtMs: number | null, nowMs: number): number {
  return expiresAtMs === null ? 0 : Math.max(0, expiresAtMs - nowMs);
}

// 47:05:09 — hours keep counting past a day, because the offer lasts 48 hours.
export function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.floor(remainingMs / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

export function spokenCountdown(remainingMs: number): string {
  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hourText = hours > 0 ? `${hours} ${hours === 1 ? "hour" : "hours"}` : null;
  const minuteText = minutes > 0 || hours === 0 ? `${minutes} ${minutes === 1 ? "minute" : "minutes"}` : null;
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
  const running = props.expiresAtMs !== null && props.discountPercent !== null;
  const remainingMs = remainingOfferMs(props.expiresAtMs, useNow(running));
  if (!running || remainingMs <= 0) {
    return null;
  }
  const title = `${props.discountPercent}% off Pro`;
  return (
    <View
      accessibilityLabel={`${title}. Offer ends in ${spokenCountdown(remainingMs)}`}
      accessibilityRole="text"
      accessible
      style={styles.offer}
    >
      <Text style={styles.offerTitle}>{title}</Text>
      <Text style={styles.offerCountdown}>Ends in {formatCountdown(remainingMs)}</Text>
    </View>
  );
}
