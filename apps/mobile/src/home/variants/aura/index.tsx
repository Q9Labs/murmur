import type { ReactNode } from "react";
import {
  Animated,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useMicLevel, usePulse, useReducedMotion } from "../hooks";
import { PhraseCaptions, SpanTimeline, StatusMessages } from "../shared";
import { PrimaryAction, SettingsChrome, TextLanguageRow, TextModeTabs } from "../sharedControls";
import type { VariantShellProps } from "../types";
import { auraColors, styles } from "./styles";

const grainTexture = require("../../../../assets/images/grain.png");

export function AuraShell(props: VariantShellProps): ReactNode {
  const { live, translationMode, viewModel } = props;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <AuraBackdrop live={viewModel.isLive} />
      <SettingsChrome
        buttonTextStyle={styles.chromeButtonText}
        containerStyle={styles.chrome}
        onOpenSettings={props.onOpenSettings}
        pressedStyle={styles.pressed}
        rightSlot={<Text style={styles.chromeStatus}>{viewModel.isLive ? "Live" : viewModel.healthText}</Text>}
      />
      {translationMode === "continuous" ? (
        <SpanTimeline
          contentStyle={styles.timelineContent}
          live={live}
          style={styles.stageScroll}
          textStyles={{
            partial: styles.translationPartial,
            rtl: styles.rtlText,
            source: styles.sourceText,
            translation: styles.timelineTranslation,
          }}
          viewModel={viewModel}
          continuousAutoScrollRef={props.continuousAutoScrollRef}
          continuousTimelineRef={props.continuousTimelineRef}
          continuousUserInteractedRef={props.continuousUserInteractedRef}
        />
      ) : (
        <PhraseStage viewModel={viewModel} />
      )}
      <View style={styles.footer}>
        <StatusMessages errorStyle={styles.error} live={live} receiptStyle={styles.receipt} />
        <View style={styles.hairline} />
        <View style={styles.controlRow}>
          <TextLanguageRow
            containerStyle={styles.languageRow}
            onOpenPicker={props.onOpenPicker}
            onSwapLanguages={props.onSwapLanguages}
            pressedStyle={styles.pressed}
            swapGlyph="→"
            swapStyle={styles.modeTab}
            textStyle={styles.controlText}
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
        </View>
        <ListenRing
          canStart={viewModel.canStart}
          isLive={viewModel.isLive}
          onPrimaryAction={props.onPrimaryAction}
        />
      </View>
    </SafeAreaView>
  );
}

const orbLayers = [
  { color: auraColors.violet, drift: 30, duration: 9000, size: 340, style: { left: -110, top: -90 } },
  { color: auraColors.blue, drift: -26, duration: 13000, size: 300, style: { right: -120, top: 150 } },
  { color: auraColors.teal, drift: 24, duration: 16000, size: 320, style: { bottom: -70, left: -50 } },
] as const;

export function AuraBackdrop({ live }: { live: boolean }): ReactNode {
  const micLevel = useMicLevel(live);
  const breathe = micLevel.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {orbLayers.map((layer) => (
        <DriftOrb breathe={breathe} key={layer.color} layer={layer} />
      ))}
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="repeat"
        source={grainTexture}
        style={styles.grain}
      />
    </View>
  );
}

function DriftOrb({
  breathe,
  layer,
}: {
  breathe: Animated.AnimatedInterpolation<number>;
  layer: (typeof orbLayers)[number];
}): ReactNode {
  const reducedMotion = useReducedMotion();
  const pulse = usePulse(!reducedMotion, reducedMotion, layer.duration);
  const translate = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, layer.drift] });

  return (
    <Animated.View
      style={[
        styles.orb,
        layer.style,
        {
          backgroundColor: layer.color,
          height: layer.size,
          opacity: 0.17,
          transform: [{ translateX: translate }, { translateY: translate }, { scale: breathe }],
          width: layer.size,
        },
      ]}
    />
  );
}

function PhraseStage({ viewModel }: { viewModel: VariantShellProps["viewModel"] }): ReactNode {
  return (
    <ScrollView contentContainerStyle={styles.stage} showsVerticalScrollIndicator={false} style={styles.stageScroll}>
      <Text style={styles.eyebrow}>{viewModel.targetLanguage.display_name}</Text>
      <PhraseCaptions
        partialStyle={styles.translationPartial}
        sourceRtlStyle={styles.rtlText}
        sourceStyle={styles.sourceText}
        translationRtlStyle={styles.rtlText}
        translationStyle={styles.translationText}
        viewModel={viewModel}
      />
    </ScrollView>
  );
}

function ListenRing({
  canStart,
  isLive,
  onPrimaryAction,
}: {
  canStart: boolean;
  isLive: boolean;
  onPrimaryAction: () => void;
}): ReactNode {
  const reducedMotion = useReducedMotion();
  const pulse = usePulse(isLive, reducedMotion, 2000);
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });

  return (
    <View style={styles.ringWrap}>
      {isLive ? <Animated.View style={[styles.ringGlow, { transform: [{ scale: glowScale }] }]} /> : null}
      <PrimaryAction
        canStart={canStart}
        isLive={isLive}
        onPrimaryAction={onPrimaryAction}
        pressedStyle={styles.pressed}
        startLabel="Listen"
        stopLabel="Stop"
        style={styles.ring}
        textStyle={styles.ringLabel}
      />
    </View>
  );
}
