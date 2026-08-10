import { Settings as SettingsIcon } from "lucide-react-native";
import { useRef, type ReactNode } from "react";
import {
  Animated,
  Image,
  Pressable,
  StatusBar,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useMicLevel, usePulse, useReducedMotion } from "../hooks";
import { SpanTimeline, StatusMessages } from "../shared";
import { PrimaryAction, TextLanguageRow } from "../sharedControls";
import type { VariantShellProps } from "../types";
import { TranslatedAudioControl } from "./audioControl";
import { useBloomStyles } from "./styles";

const brandLogo = require("../../../../assets/images/icon.png");

export function BloomShell(props: VariantShellProps): ReactNode {
  const { live, viewModel } = props;
  const { colors, styles } = useBloomStyles();

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle={colors.dark ? "light-content" : "dark-content"} />
      <BloomChrome
        audioPlaybackEnabled={props.audioPlaybackEnabled}
        onAudioPlaybackEnabledChange={props.onAudioPlaybackEnabledChange}
        onOpenSettings={props.onOpenSettings}
      />
      <TranslationStage {...props} />
      <View style={styles.controlColumn}>
        <StatusMessages errorStyle={styles.error} live={live} receiptStyle={styles.receipt} />
        <TextLanguageRow
          containerStyle={styles.languageRow}
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
          startLabel="Listen"
          stopLabel="Stop"
          style={styles.listenPill}
          textStyle={styles.listenPillText}
        />
      </View>
    </SafeAreaView>
  );
}

export function BrandMark(): ReactNode {
  const { styles } = useBloomStyles();
  return (
    <View accessible accessibilityLabel="Murmur" accessibilityRole="image" style={styles.brandMark}>
      <Image accessibilityIgnoresInvertColors source={brandLogo} style={styles.brandLogo} />
      <Text style={styles.wordmark}>Murmur</Text>
    </View>
  );
}

function BloomChrome({
  audioPlaybackEnabled,
  onAudioPlaybackEnabledChange,
  onOpenSettings,
}: {
  audioPlaybackEnabled: boolean;
  onAudioPlaybackEnabledChange: (enabled: boolean) => void;
  onOpenSettings: () => void;
}): ReactNode {
  const { colors, styles } = useBloomStyles();
  return (
    <View style={styles.chrome}>
      <BrandMark />
      <View style={styles.chromeActions}>
        <TranslatedAudioControl
          enabled={audioPlaybackEnabled}
          onChange={onAudioPlaybackEnabledChange}
        />
        <Pressable
          accessibilityLabel="Open settings"
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
  return (
    <View style={styles.flexFill}>
      <SpanTimeline
        contentStyle={styles.timelineContent}
        autoScrollRef={props.autoScrollRef}
        live={props.live}
        style={styles.flexFill}
        textStyles={{
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
