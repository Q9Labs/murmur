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
import { styles } from "./styles";

const brandLogo = require("../../../../assets/images/icon.png");

export function BloomShell(props: VariantShellProps): ReactNode {
  const { live, viewModel } = props;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <BloomChrome onOpenSettings={props.onOpenSettings} />
      <LiveStatus isLive={viewModel.isLive} />
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
          style={[styles.listenPill, viewModel.isLive && styles.stopPill]}
          textStyle={styles.listenPillText}
        />
      </View>
    </SafeAreaView>
  );
}

export function BrandMark(): ReactNode {
  return (
    <View accessible accessibilityLabel="Murmur" accessibilityRole="image" style={styles.brandMark}>
      <Image accessibilityIgnoresInvertColors source={brandLogo} style={styles.brandLogo} />
      <Text style={styles.wordmark}>Murmur</Text>
    </View>
  );
}

function BloomChrome({ onOpenSettings }: { onOpenSettings: () => void }): ReactNode {
  return (
    <View style={styles.chrome}>
      <BrandMark />
      <Pressable
        accessibilityLabel="Open settings"
        accessibilityRole="button"
        onPress={onOpenSettings}
        style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}
      >
        <Text style={styles.settingsGlyph}>···</Text>
      </Pressable>
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

function LiveStatus({ isLive }: { isLive: boolean }): ReactNode {
  const reducedMotion = useReducedMotion();
  const pulse = usePulse(isLive && !reducedMotion, reducedMotion, 1800);
  const dotScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] });
  const label = isLive ? "Listening now" : "Ready to listen";

  return (
    <View
      accessible
      accessibilityLabel={`Status: ${label}`}
      accessibilityRole="text"
      style={styles.liveStatus}
    >
      <Animated.View
        style={[
          styles.liveStatusDot,
          isLive ? styles.liveStatusDotLive : styles.liveStatusDotReady,
          { transform: [{ scale: dotScale }] },
        ]}
      />
      <Text style={styles.liveStatusText}>{label}</Text>
    </View>
  );
}

function ListeningSignal({ isLive }: { isLive: boolean }): ReactNode {
  const scale = useBreathScale(isLive, false);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.signalWrap}
    >
      <Animated.View style={[styles.signalBar, styles.signalBarCoral, { transform: [{ scaleY: scale }] }]} />
      <Animated.View style={[styles.signalBar, styles.signalBarTeal, { transform: [{ scaleY: scale }] }]} />
      <Animated.View style={[styles.signalBar, styles.signalBarGold, { transform: [{ scaleY: scale }] }]} />
      <Animated.View style={[styles.signalBar, styles.signalBarViolet, { transform: [{ scaleY: scale }] }]} />
    </View>
  );
}

function TranslationStage(props: VariantShellProps): ReactNode {
  return (
    <View style={styles.flexFill}>
      <View style={styles.captionSurface}>
        <ListeningSignal isLive={props.viewModel.isLive} />
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
    </View>
  );
}
