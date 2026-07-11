import type { ReactNode } from "react";
import {
  Animated,
  ScrollView,
  StatusBar,
  Text,
  View,
  type TextStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useMicLevel, usePulse, useReducedMotion } from "../hooks";
import { PhraseCaptions, SpanTimeline, StatusMessages } from "../shared";
import { PrimaryAction, SettingsChrome, TextLanguageRow, TextModeTabs } from "../sharedControls";
import type { VariantShellProps } from "../types";
import { styles } from "./styles";

export function BloomShell(props: VariantShellProps): ReactNode {
  const { live, translationMode, viewModel } = props;

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
      {translationMode === "continuous" ? <ContinuousStage {...props} /> : <PhraseStage viewModel={viewModel} />}
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
        <TextModeTabs
          activeStyle={styles.modeTabActive}
          canChangeLanguages={viewModel.canChangeLanguages}
          containerStyle={styles.modeTabs}
          inactiveStyle={styles.modeTab}
          onToggleTranslationMode={props.onToggleTranslationMode}
          pressedStyle={styles.pressed}
          translationMode={translationMode}
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

function PhraseStage({ viewModel }: { viewModel: VariantShellProps["viewModel"] }): ReactNode {
  return (
    <ScrollView contentContainerStyle={styles.stage} showsVerticalScrollIndicator={false} style={styles.flexFill}>
      <BreathingBlob isLive={viewModel.isLive} />
      <PhraseCaptions
        partialStyle={styles.translationPartial}
        sourceRtlStyle={rtlWriting}
        sourceStyle={[styles.sourceText, centeredSource]}
        translationRtlStyle={rtlWriting}
        translationStyle={styles.translationText}
        viewModel={viewModel}
      />
    </ScrollView>
  );
}

const rtlWriting: TextStyle = { writingDirection: "rtl" };
const centeredSource: TextStyle = { textAlign: "center" };

function ContinuousStage(props: VariantShellProps): ReactNode {
  return (
    <View style={styles.flexFill}>
      <BlobDot isLive={props.viewModel.isLive} />
      <SpanTimeline
        contentStyle={styles.timelineContent}
        continuousAutoScrollRef={props.continuousAutoScrollRef}
        continuousTimelineRef={props.continuousTimelineRef}
        continuousUserInteractedRef={props.continuousUserInteractedRef}
        live={props.live}
        style={styles.flexFill}
        textStyles={{
          partial: styles.translationPartial,
          rtl: styles.rtlText,
          source: styles.sourceText,
          translation: styles.timelineTranslation,
        }}
        viewModel={props.viewModel}
      />
    </View>
  );
}
