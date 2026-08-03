import type { ReactNode } from "react";
import {
  Animated,
  StatusBar,
  Text,
  View,
  type TextStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useMicLevel, usePulse, useReducedMotion } from "../hooks";
import { SpanTimeline, StatusMessages } from "../shared";
import { PrimaryAction, SettingsChrome, TextLanguageRow } from "../sharedControls";
import type { VariantShellProps } from "../types";
import { styles } from "./styles";

export function BloomShell(props: VariantShellProps): ReactNode {
  const { live, viewModel } = props;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <SettingsChrome
        buttonTextStyle={styles.chromeButtonText}
        containerStyle={styles.chrome}
        onOpenSettings={props.onOpenSettings}
        pressedStyle={styles.pressed}
        rightSlot={<Text style={styles.wordmark}>Murmur</Text>}
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

function useBreathScale(isLive: boolean): ReturnType<typeof Animated.add> {
  const reducedMotion = useReducedMotion();
  const pulse = usePulse(!reducedMotion, reducedMotion, isLive ? 2400 : 4800);
  const micLevel = useMicLevel(isLive);
  const sway = Animated.add(Animated.multiply(pulse, 0.05), Animated.multiply(micLevel, 0.16));
  return Animated.add(new Animated.Value(1), sway);
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
      style={styles.blobWrap}
    >
      <Animated.View style={[styles.blobHalo, { transform: [{ rotate: tilt }, { scale }] }]} />
      <Animated.View style={[styles.blobBody, { transform: [{ scale }] }]} />
    </View>
  );
}

function BlobDot({ isLive }: { isLive: boolean }): ReactNode {
  const scale = useBreathScale(isLive);

  return (
    <View style={styles.blobDotWrap}>
      <Animated.View style={[styles.blobDot, { transform: [{ scale }] }]} />
    </View>
  );
}

const rtlWriting: TextStyle = { writingDirection: "rtl" };

function TranslationStage(props: VariantShellProps): ReactNode {
  return (
    <View style={styles.flexFill}>
      <BlobDot isLive={props.viewModel.isLive} />
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
