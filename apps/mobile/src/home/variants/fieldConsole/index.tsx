import type { ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { TranslationSpan } from "@murmur/protocol/session";
import { useMicLevelValue } from "../hooks";
import {
  deriveSignalStages,
  formatClockTime,
  formatLatencyMs,
  hasVisibleTimeline,
  isPartialSpan,
  latestCommittedLatencyMs,
  shouldHideSpan,
  timelineTranslationText,
} from "../logic";
import { timelineScrollHandlers, StatusMessages } from "../shared";
import { PrimaryAction } from "../sharedControls";
import type { VariantShellProps } from "../types";
import { consoleAccents, consolePalettes, styles, type ConsolePalette } from "./styles";

function shellSignalStages(props: VariantShellProps): ReturnType<typeof deriveSignalStages> {
  return deriveSignalStages({
    captureActive: Boolean(props.audioState?.capture_active),
    hasTentativeCaption: Boolean(props.live.spans.at(-1)?.source_caption.trim()),
    pendingCount: props.viewModel.pendingCount,
    playbackActive: Boolean(props.audioState?.playback_active),
  });
}

export function FieldConsoleShell(props: VariantShellProps): ReactNode {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const palette = consolePalettes[dark ? "dark" : "light"];
  const { live, viewModel } = props;
  const stages = shellSignalStages(props);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.chassis }]}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />
      <Header live={live} onOpenSettings={props.onOpenSettings} palette={palette} viewModel={viewModel} />
      <View style={styles.main}>
        <SignalPanel {...props} palette={palette} />
        <ReadoutPanel {...props} palette={palette} />
        <StatusMessages
          errorStyle={[styles.error, errorColor]}
          live={live}
          receiptStyle={[styles.error, receiptColor]}
        />
        <PrimaryAction
          canStart={viewModel.canStart}
          isLive={viewModel.isLive}
          onPrimaryAction={props.onPrimaryAction}
          pressedStyle={styles.pressed}
          startLabel="LISTEN"
          stopLabel="STOP"
          style={styles.listenKey}
          textStyle={styles.listenKeyText}
        />
      </View>
      <SignalChain palette={palette} stages={stages} />
    </SafeAreaView>
  );
}

const errorColor = { color: consoleAccents.record } as const;
const receiptColor = { color: consoleAccents.signal } as const;

function Header({
  live,
  onOpenSettings,
  palette,
  viewModel,
}: {
  live: VariantShellProps["live"];
  onOpenSettings: () => void;
  palette: ConsolePalette;
  viewModel: VariantShellProps["viewModel"];
}): ReactNode {
  const latency = formatLatencyMs(latestCommittedLatencyMs(live.spans));

  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Open settings"
        accessibilityRole="button"
        onPress={onOpenSettings}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        <Text style={[styles.wordmark, { color: palette.ink }]}>MURMUR</Text>
      </Pressable>
      <View
        accessible
        accessibilityLabel={`Murmur health ${viewModel.healthText}, latency ${latency}`}
        accessibilityRole="text"
        style={styles.headerCluster}
      >
        <View style={[styles.light, { backgroundColor: healthLightColor(viewModel.healthText, palette) }]} />
        <Text style={[styles.headerStat, { color: palette.ink }]}>
          {viewModel.healthText.toUpperCase()}
        </Text>
        <Text style={[styles.headerStat, { color: palette.muted }]}>{`LAT ${latency}`}</Text>
      </View>
    </View>
  );
}

const healthLightColors: Record<string, string> = {
  Degraded: consoleAccents.caution,
  Disconnected: consoleAccents.record,
  OK: consoleAccents.signal,
  Recovering: consoleAccents.caution,
};

function healthLightColor(healthText: string, palette: ConsolePalette): string {
  return healthLightColors[healthText] ?? palette.muted;
}

const vuSegmentCount = 12;

function SignalPanel({
  onOpenPicker,
  onSwapLanguages,
  palette,
  viewModel,
}: VariantShellProps & { palette: ConsolePalette }): ReactNode {
  const micLevel = useMicLevelValue(viewModel.isLive);
  const activeSegments = Math.round(micLevel * vuSegmentCount);

  return (
    <View style={[styles.panel, { backgroundColor: palette.panel, borderColor: palette.hairline }]}>
      <View
        accessible
        accessibilityLabel={`Microphone level ${Math.round(micLevel * 100)} percent`}
        accessibilityRole="progressbar"
        style={styles.vuRow}
      >
        <Text style={[styles.kicker, { color: palette.muted }]}>MIC</Text>
        <View style={styles.vuSegments}>
          {Array.from({ length: vuSegmentCount }, (_, segment) => (
            <View
              key={segment}
              style={[
                styles.vuSegment,
                { backgroundColor: segment < activeSegments ? vuSegmentColor(segment) : palette.hairline },
              ]}
            />
          ))}
        </View>
      </View>
      <View style={styles.routeRow}>
        <RouteKey
          accessibilityLabel="Change spoken language"
          disabled={!viewModel.canChangeLanguages}
          label={viewModel.sourceLanguageDisplayName}
          onPress={() => onOpenPicker("source")}
          palette={palette}
        />
        <Text style={[styles.headerStat, { color: palette.muted }]}>{"->"}</Text>
        <RouteKey
          accessibilityLabel="Change translation language"
          disabled={!viewModel.canChangeLanguages}
          label={viewModel.targetLanguage.display_name}
          onPress={() => onOpenPicker("target")}
          palette={palette}
        />
        <RouteKey
          accessibilityLabel="Reverse translation languages"
          disabled={!viewModel.canSwapLanguages}
          label={"<>"}
          onPress={onSwapLanguages}
          palette={palette}
        />
      </View>
    </View>
  );
}

function vuSegmentColor(segment: number): string {
  if (segment >= 10) {
    return consoleAccents.record;
  }
  if (segment >= 8) {
    return consoleAccents.caution;
  }
  return consoleAccents.signal;
}

function RouteKey({
  accessibilityLabel,
  disabled,
  label,
  onPress,
  palette,
}: {
  accessibilityLabel: string;
  disabled: boolean;
  label: string;
  onPress: () => void;
  palette: ConsolePalette;
}): ReactNode {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.routeKey,
        { borderColor: palette.hairline },
        (pressed || disabled) && styles.pressed,
      ]}
    >
      <Text numberOfLines={1} style={[styles.routeKeyText, { color: palette.ink }]}>
        {label.toUpperCase()}
      </Text>
    </Pressable>
  );
}

function ReadoutPanel(props: VariantShellProps & { palette: ConsolePalette }): ReactNode {
  const { palette } = props;

  return (
    <View style={[styles.readoutPanel, { backgroundColor: palette.panel, borderColor: palette.hairline }]}>
      <LogTimeline {...props} />
    </View>
  );
}

function LogTimeline(props: VariantShellProps & { palette: ConsolePalette }): ReactNode {
  const { live, palette, viewModel } = props;
  const sourceRtl = Boolean(viewModel.sourceLanguage?.rtl);
  const visibleSpans = visibleLogSpans(live.spans);
  const hasTimeline = hasVisibleTimeline(visibleSpans, live.tentative_source_caption);

  return (
    <ScrollView
      ref={props.timelineRef}
      scrollEventThrottle={80}
      showsVerticalScrollIndicator
      {...timelineScrollHandlers(props)}
    >
      {!hasTimeline ? <LogEmptyNotice isLive={viewModel.isLive} palette={palette} /> : null}
      {visibleSpans.map((span) => (
        <LogRow
          key={`${span.span_id}:${span.revision}`}
          palette={palette}
          sourceRtl={sourceRtl}
          span={span}
          targetRtl={viewModel.targetLanguage.rtl}
        />
      ))}
      <ListeningRow
        palette={palette}
        sourceRtl={sourceRtl}
        text={live.tentative_source_caption}
      />
    </ScrollView>
  );
}

function visibleLogSpans(spans: TranslationSpan[]): TranslationSpan[] {
  return spans.filter((span) => !shouldHideSpan(span));
}

function LogEmptyNotice({ isLive, palette }: { isLive: boolean; palette: ConsolePalette }): ReactNode {
  return (
    <Text style={[styles.readoutSource, { color: palette.muted }]}>
      {isLive ? "Recording log. Spans commit as they finish." : "The session log starts when you tap LISTEN."}
    </Text>
  );
}

function ListeningRow({
  palette,
  sourceRtl,
  text,
}: {
  palette: ConsolePalette;
  sourceRtl: boolean;
  text: string;
}): ReactNode {
  if (!text.trim()) {
    return null;
  }
  return (
    <View style={styles.logRow}>
      <Text style={[styles.logStamp, { color: consoleAccents.signal }]}>LISTENING</Text>
      <Text style={[styles.logSource, { color: palette.muted }, sourceRtl && styles.rtlText]}>{text}</Text>
    </View>
  );
}

function logStampText(span: TranslationSpan): string {
  return `${formatClockTime(span.created_at_ms)}${isPartialSpan(span) ? "  TRANSLATING" : ""}`;
}

function LogRow({
  palette,
  sourceRtl,
  span,
  targetRtl,
}: {
  palette: ConsolePalette;
  sourceRtl: boolean;
  span: TranslationSpan;
  targetRtl: boolean;
}): ReactNode {
  return (
    <View style={[styles.logRow, { borderBottomColor: palette.hairline, borderBottomWidth: 1 }]}>
      <Text style={[styles.logStamp, { color: palette.muted }]}>{logStampText(span)}</Text>
      <Text
        style={[
          styles.logTranslation,
          { color: palette.ink },
          isPartialSpan(span) && styles.translationPartial,
          targetRtl && styles.rtlText,
        ]}
      >
        {timelineTranslationText(span)}
      </Text>
      <Text style={[styles.logSource, { color: palette.muted }, sourceRtl && styles.rtlText]}>
        {span.source_caption}
      </Text>
    </View>
  );
}

const chainStages = [
  { key: "listen", label: "MIC", name: "Microphone" },
  { key: "transcribe", label: "STT", name: "Transcription" },
  { key: "translate", label: "TRA", name: "Translation" },
  { key: "speak", label: "TTS", name: "Speech" },
] as const;

function SignalChain({
  palette,
  stages,
}: {
  palette: ConsolePalette;
  stages: Record<(typeof chainStages)[number]["key"], boolean>;
}): ReactNode {
  return (
    <View style={styles.chainRow}>
      {chainStages.map((stage, index) => (
        <ChainStage
          active={stages[stage.key]}
          key={stage.key}
          label={stage.label}
          name={stage.name}
          palette={palette}
          showArrow={index > 0}
        />
      ))}
    </View>
  );
}

function chainStageColors(active: boolean, palette: ConsolePalette): { label: string; light: string } {
  return {
    label: active ? palette.ink : palette.muted,
    light: active ? consoleAccents.signal : palette.hairline,
  };
}

function ChainStage({
  active,
  label,
  name,
  palette,
  showArrow,
}: {
  active: boolean;
  label: string;
  name: string;
  palette: ConsolePalette;
  showArrow: boolean;
}): ReactNode {
  const colors = chainStageColors(active, palette);

  return (
    <View
      accessibilityLabel={`${name} ${active ? "active" : "idle"}`}
      accessible
      style={styles.chainStage}
    >
      {showArrow ? <Text style={[styles.chainLabel, { color: palette.muted }]}>{"->"}</Text> : null}
      <View style={[styles.light, { backgroundColor: colors.light }]} />
      <Text style={[styles.chainLabel, { color: colors.label }]}>{label}</Text>
    </View>
  );
}
