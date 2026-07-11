import type { ReactNode } from "react";
import {
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import type { TranslationSpan } from "@murmur/protocol/session";
import { formatLiveError, formatReportError } from "../errorCopy";
import {
  hasVisibleTimeline,
  isPartialSpan,
  shouldHideSpan,
  shouldKeepAutoScroll,
  timelineTranslationText,
} from "./logic";
import type { VariantShellProps } from "./types";

function visibleLiveError(live: VariantShellProps["live"]): string | null {
  if (!live.error || live.error === "microphone_permission_denied") {
    return null;
  }
  return formatLiveError(live.error);
}

export function StatusMessages({
  errorStyle,
  live,
  receiptStyle,
}: {
  errorStyle: StyleProp<TextStyle>;
  live: VariantShellProps["live"];
  receiptStyle: StyleProp<TextStyle>;
}): ReactNode {
  const liveError = visibleLiveError(live);

  return (
    <>
      {liveError ? <Text style={errorStyle}>{liveError}</Text> : null}
      {live.report_error ? <Text style={errorStyle}>{formatReportError(live.report_error)}</Text> : null}
      {live.report_receipt_id ? (
        <Text style={receiptStyle}>Report received: {live.report_receipt_id.slice(0, 8)}</Text>
      ) : null}
    </>
  );
}

type ContinuousScrollRefs = Pick<
  VariantShellProps,
  "continuousAutoScrollRef" | "continuousTimelineRef" | "continuousUserInteractedRef"
>;

export function continuousScrollHandlers(refs: ContinuousScrollRefs): {
  onContentSizeChange: () => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollBeginDrag: () => void;
} {
  return {
    onContentSizeChange: () => {
      if (refs.continuousAutoScrollRef.current || !refs.continuousUserInteractedRef.current) {
        refs.continuousTimelineRef.current?.scrollToEnd({ animated: true });
      }
    },
    onScroll: (event) => {
      if (refs.continuousUserInteractedRef.current) {
        refs.continuousAutoScrollRef.current = shouldKeepAutoScroll(event.nativeEvent);
      }
    },
    onScrollBeginDrag: () => {
      refs.continuousUserInteractedRef.current = true;
    },
  };
}

function continuousEmptyText(isLive: boolean): string {
  return isLive
    ? "Listening. The conversation will appear here."
    : "The conversation appears here once you start.";
}

export type TimelineTextStyles = {
  partial: StyleProp<TextStyle>;
  rtl: StyleProp<TextStyle>;
  source: StyleProp<TextStyle>;
  translation: StyleProp<TextStyle>;
};

export function SpanTimeline({
  contentStyle,
  live,
  style,
  textStyles,
  viewModel,
  ...refs
}: ContinuousScrollRefs & {
  contentStyle?: StyleProp<ViewStyle>;
  live: VariantShellProps["live"];
  style?: StyleProp<ViewStyle>;
  textStyles: TimelineTextStyles;
  viewModel: VariantShellProps["viewModel"];
}): ReactNode {
  const sourceRtl = Boolean(viewModel.sourceLanguage?.rtl);
  const visibleSpans = live.spans.filter((span) => !shouldHideSpan(span));
  const hasTimeline = hasVisibleTimeline(visibleSpans, live.tentative_source_caption);

  return (
    <ScrollView
      contentContainerStyle={contentStyle}
      ref={refs.continuousTimelineRef}
      scrollEventThrottle={80}
      showsVerticalScrollIndicator={false}
      style={style}
      {...continuousScrollHandlers(refs)}
    >
      {!hasTimeline ? (
        <Text style={textStyles.source}>{continuousEmptyText(viewModel.isLive)}</Text>
      ) : null}
      {visibleSpans.map((span) => (
        <SpanRow
          key={`${span.span_id}:${span.revision}`}
          sourceRtl={sourceRtl}
          span={span}
          targetRtl={viewModel.targetLanguage.rtl}
          textStyles={textStyles}
        />
      ))}
      {live.tentative_source_caption.trim() ? (
        <TentativeCaption sourceRtl={sourceRtl} text={live.tentative_source_caption} textStyles={textStyles} />
      ) : null}
    </ScrollView>
  );
}

function TentativeCaption({
  sourceRtl,
  text,
  textStyles,
}: {
  sourceRtl: boolean;
  text: string;
  textStyles: TimelineTextStyles;
}): ReactNode {
  return <Text style={[textStyles.source, sourceRtl && textStyles.rtl]}>{text}</Text>;
}

function SpanRow({
  sourceRtl,
  span,
  targetRtl,
  textStyles,
}: {
  sourceRtl: boolean;
  span: TranslationSpan;
  targetRtl: boolean;
  textStyles: TimelineTextStyles;
}): ReactNode {
  return (
    <View>
      <Text
        style={[
          textStyles.translation,
          isPartialSpan(span) && textStyles.partial,
          targetRtl && textStyles.rtl,
        ]}
      >
        {timelineTranslationText(span)}
      </Text>
      <Text style={[textStyles.source, sourceRtl && textStyles.rtl]}>{span.source_caption}</Text>
    </View>
  );
}

type PhraseCaptionProps = {
  partialStyle: StyleProp<TextStyle>;
  sourceRtlStyle: StyleProp<TextStyle>;
  sourceStyle: StyleProp<TextStyle>;
  translationRtlStyle: StyleProp<TextStyle>;
  translationStyle: StyleProp<TextStyle>;
  viewModel: VariantShellProps["viewModel"];
};

export function PhraseCaptions(props: PhraseCaptionProps): ReactNode {
  return (
    <>
      <TranslationCaption {...props} />
      <SourceCaption {...props} />
    </>
  );
}

function TranslationCaption({ partialStyle, translationRtlStyle, translationStyle, viewModel }: PhraseCaptionProps): ReactNode {
  return (
    <Text
      numberOfLines={8}
      style={[
        translationStyle,
        viewModel.latestTranslationIsPartial && partialStyle,
        viewModel.hasTranslatedText && viewModel.targetLanguage.rtl && translationRtlStyle,
      ]}
    >
      {viewModel.primaryCanvasText}
    </Text>
  );
}

function SourceCaption({ sourceRtlStyle, sourceStyle, viewModel }: PhraseCaptionProps): ReactNode {
  return (
    <Text
      numberOfLines={4}
      style={[
        sourceStyle,
        viewModel.hasSourceText && Boolean(viewModel.sourceLanguage?.rtl) && sourceRtlStyle,
      ]}
    >
      {viewModel.secondaryCanvasText}
    </Text>
  );
}
