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

type TimelineScrollRefs = Pick<VariantShellProps, "autoScrollRef" | "timelineRef" | "userInteractedRef">;

export function timelineScrollHandlers(refs: TimelineScrollRefs): {
  onContentSizeChange: () => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollBeginDrag: () => void;
} {
  return {
    onContentSizeChange: () => {
      if (refs.autoScrollRef.current || !refs.userInteractedRef.current) {
        refs.timelineRef.current?.scrollToEnd({ animated: true });
      }
    },
    onScroll: (event) => {
      if (refs.userInteractedRef.current) {
        refs.autoScrollRef.current = shouldKeepAutoScroll(event.nativeEvent);
      }
    },
    onScrollBeginDrag: () => {
      refs.userInteractedRef.current = true;
    },
  };
}

function timelineEmptyText(isLive: boolean): string {
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
}: TimelineScrollRefs & {
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
      ref={refs.timelineRef}
      scrollEventThrottle={80}
      showsVerticalScrollIndicator={false}
      style={style}
      {...timelineScrollHandlers(refs)}
    >
      {!hasTimeline ? (
        <Text style={textStyles.source}>{timelineEmptyText(viewModel.isLive)}</Text>
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
