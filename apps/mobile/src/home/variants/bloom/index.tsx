import { useRouter } from "expo-router";
import { History as HistoryIcon, Settings as SettingsIcon } from "lucide-react-native";
import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  Image,
  Pressable,
  StatusBar,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { hasTimeAvailable, lowBalanceMinutes } from "../../../lib/billing/allowance";
import { useMurmurBilling } from "../../../lib/billing/context";
import { captureBillingTelemetry } from "../../../lib/telemetry";
import { isAllowanceExhaustedError } from "../../errorCopy";
import { formatUiNumber, uiContentDirectionStyle, useUiLocale } from "../../../i18n/runtime";
import { useMicLevel, usePulse, useReducedMotion } from "../hooks";
import { primaryStartLabel } from "../logic";
import { SpanTimeline, StatusMessages } from "../shared";
import { PrimaryAction, TextLanguageRow } from "../sharedControls";
import type { VariantShellProps } from "../types";
import { TranslatedAudioControl } from "./audioControl";
import { BackgroundListeningPill } from "./backgroundListening";
import { CaptureSourceControl } from "./captureSourceControl";
import { useBloomStyles } from "./styles";

const brandLogo = require("../../../../assets/images/icon.png");

export function BloomShell(props: VariantShellProps): ReactNode {
  const { live, viewModel } = props;
  const { colors, styles } = useBloomStyles();
  const billing = useMurmurBilling();
  const wasLive = useRef(viewModel.isLive);
  const lowBalance = viewModel.isLive
    ? null
    : lowBalanceMinutes(billing.customer, billing.config.lowBalanceThresholdMinutes);

  useEffect(() => {
    if (wasLive.current && !viewModel.isLive) {
      void billing.refresh();
    }
    wasLive.current = viewModel.isLive;
  }, [billing.refresh, viewModel.isLive]);

  useEffect(() => {
    if (lowBalance) {
      captureBillingTelemetry("mobile_low_balance_viewed");
    }
  }, [lowBalance]);

  useEffect(() => {
    if (isAllowanceExhaustedError(live.error)) {
      captureBillingTelemetry("mobile_allowance_exhausted");
    }
  }, [live.error]);
  const { locale, t } = useUiLocale();

  return (
    <SafeAreaView style={[styles.screen, uiContentDirectionStyle(locale)]}>
      <StatusBar barStyle={colors.dark ? "light-content" : "dark-content"} />
      <BloomChrome
        audioPlaybackAvailable={props.audioPlaybackAvailable}
        audioPlaybackEnabled={props.audioPlaybackEnabled}
        onAudioPlaybackEnabledChange={props.onAudioPlaybackEnabledChange}
        onOpenSettings={props.onOpenSettings}
      />
      <TranslationStage {...props} />
      <View style={styles.controlColumn}>
        <StatusMessages errorStyle={styles.error} live={live} receiptStyle={styles.receipt} />
        {lowBalance ? (
          <LowBalancePill minutes={lowBalance} onPress={props.onOpenLowBalance} />
        ) : null}
        {props.listeningInBackground ? <BackgroundListeningPill /> : (
          <Text accessibilityLiveRegion="polite" style={styles.sessionStatus}>
            {viewModel.statusText}
          </Text>
        )}
        <CaptureSourceControl
          devicePlaybackSupported={props.devicePlaybackSupported}
          disabled={!viewModel.canChangeLanguages}
          onChange={props.onCaptureSourceChange}
          source={props.captureSource}
        />
        <TextLanguageRow
          containerStyle={styles.languageRow}
          labelStyle={styles.languageLabel}
          onOpenPicker={props.onOpenPicker}
          onSwapLanguages={props.onSwapLanguages}
          pressedStyle={styles.pressed}
          swapGlyph="⇄"
          swapStyle={styles.swapText}
          textStyle={styles.languageText}
          viewModel={viewModel}
        />
        <PrimaryAction
          canStart={viewModel.canStart}
          isLive={viewModel.isLive}
          onPrimaryAction={props.onPrimaryAction}
          pressedStyle={styles.pressed}
          startLabel={primaryStartLabel(live.error, hasTimeAvailable(billing.customer), t)}
          stopLabel={t("home.stop")}
          style={styles.listenPill}
          textStyle={styles.listenPillText}
        />
      </View>
    </SafeAreaView>
  );
}

function LowBalancePill({ minutes, onPress }: { minutes: number; onPress: () => void }): ReactNode {
  const { styles } = useBloomStyles();
  const { locale, t } = useUiLocale();
  const count = formatUiNumber(minutes, locale);
  return (
    <Pressable
      accessibilityHint={t("home.lowBalanceHint")}
      accessibilityLabel={t("home.lowBalanceLabel", { count })}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.lowBalancePill, pressed && styles.pressed]}
    >
      <View style={styles.lowBalanceDot} />
      <Text style={styles.lowBalanceText}>{t("home.lowBalanceShort", { count })}</Text>
      <Text style={styles.lowBalanceAction}>{t("home.topUp")}</Text>
    </Pressable>
  );
}

export function BrandMark(): ReactNode {
  const { styles } = useBloomStyles();
  const { t } = useUiLocale();
  return (
    <View
      accessible
      accessibilityLabel={t("accessibility.murmurBrand")}
      accessibilityRole="image"
      style={styles.brandMark}
    >
      <Image accessibilityIgnoresInvertColors source={brandLogo} style={styles.brandLogo} />
      <Text style={styles.wordmark}>Murmur</Text>
    </View>
  );
}

function BloomChrome({
  audioPlaybackAvailable,
  audioPlaybackEnabled,
  onAudioPlaybackEnabledChange,
  onOpenSettings,
}: {
  audioPlaybackAvailable: boolean;
  audioPlaybackEnabled: boolean;
  onAudioPlaybackEnabledChange: (enabled: boolean) => void;
  onOpenSettings: () => void;
}): ReactNode {
  const { colors, styles } = useBloomStyles();
  const router = useRouter();
  const { t } = useUiLocale();
  return (
    <View style={styles.chrome}>
      <BrandMark />
      <View style={styles.chromeActions}>
        <Pressable
          accessibilityLabel={t("accessibility.openHistory")}
          accessibilityRole="button"
          onPress={() => router.push("/history")}
          style={({ pressed }) => [styles.chromeButton, pressed && styles.pressed]}
        >
          <HistoryIcon color={colors.primary} size={20} strokeWidth={2} />
        </Pressable>
        <TranslatedAudioControl
          disabled={!audioPlaybackAvailable}
          enabled={audioPlaybackEnabled}
          onChange={onAudioPlaybackEnabledChange}
        />
        <Pressable
          accessibilityLabel={t("accessibility.openSettings")}
          accessibilityRole="button"
          onPress={onOpenSettings}
          style={({ pressed }) => [styles.chromeButton, pressed && styles.pressed]}
        >
          <SettingsIcon color={colors.primary} size={20} strokeWidth={2} />
        </Pressable>
      </View>
    </View>
  );
}

function useBreathScale(isLive: boolean, animateWhenIdle = true): ReturnType<typeof Animated.add> {
  const reducedMotion = useReducedMotion();
  const pulse = usePulse((isLive || animateWhenIdle) && !reducedMotion, reducedMotion, isLive ? 2400 : 4800);
  const micLevel = useMicLevel(isLive);
  const sway = Animated.add(Animated.multiply(pulse, 0.05), Animated.multiply(micLevel, 0.16));
  const baseScale = useRef(new Animated.Value(1)).current;
  return Animated.add(baseScale, sway);
}

export function BreathingBlob({ isLive }: { isLive: boolean }): ReactNode {
  const { styles } = useBloomStyles();
  const reducedMotion = useReducedMotion();
  const pulse = usePulse(!reducedMotion, reducedMotion, 5200);
  const scale = useBreathScale(isLive);
  const tilt = pulse.interpolate({ inputRange: [0, 1], outputRange: ["-5deg", "5deg"] });

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.heroWrap}
    >
      <Animated.View style={[styles.heroFrame, { transform: [{ rotate: tilt }, { scale }] }]}>
        <Image accessibilityIgnoresInvertColors source={brandLogo} style={styles.heroLogo} />
      </Animated.View>
      <View style={styles.heroAccentRow}>
        <View style={[styles.heroAccent, styles.heroAccentCoral]} />
        <View style={[styles.heroAccent, styles.heroAccentTeal]} />
        <View style={[styles.heroAccent, styles.heroAccentGold]} />
        <View style={[styles.heroAccent, styles.heroAccentViolet]} />
      </View>
    </View>
  );
}

function TranslationStage(props: VariantShellProps): ReactNode {
  const { styles } = useBloomStyles();
  const translationOnly = !props.live.source_transcript_enabled;
  return (
    <View style={styles.flexFill}>
      <SpanTimeline
        contentStyle={[styles.timelineContent, translationOnly && styles.timelineContentTranslationOnly]}
        autoScrollRef={props.autoScrollRef}
        live={props.live}
        style={styles.flexFill}
        textStyles={{
          ltr: styles.ltrText,
          partial: styles.translationPartial,
          rtl: styles.rtlText,
          source: styles.sourceText,
          translation: styles.timelineTranslation,
        }}
        timelineRef={props.timelineRef}
        userInteractedRef={props.userInteractedRef}
        viewModel={props.viewModel}
      />
    </View>
  );
}
