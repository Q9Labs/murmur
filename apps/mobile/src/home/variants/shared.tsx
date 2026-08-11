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
import { uiTextDirectionStyle, useUiLocale, type Translate } from "../../i18n/runtime";
import { formatLiveError, formatReportError } from "../errorCopy";
import { styles as homeStyles } from "../styles";
import {
  hasVisibleTimeline,
  isPartialSpan,
  shouldHideSpan,
  shouldKeepAutoScroll,
  timelineTranslationText,
} from "./logic";
import type { VariantShellProps } from "./types";

function visibleLiveError(live: VariantShellProps["live"], translate: Translate): string | null {
  if (!live.error || live.error === "microphone_permission_denied") {
    return null;
  }
  return formatLiveError(live.error, translate);
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
  const { direction, t } = useUiLocale();
  const liveError = visibleLiveError(live, t);

  return (
    <>
      {liveError ? <Text style={[errorStyle, uiTextDirectionStyle(direction)]}>{liveError}</Text> : null}
      {live.report_error ? (
        <Text style={[errorStyle, uiTextDirectionStyle(direction)]}>
          {formatReportError(live.report_error, t)}
        </Text>
      ) : null}
      {live.report_receipt_id ? (
        <Text style={[receiptStyle, uiTextDirectionStyle(direction)]}>
          {t("home.reportReceived", { receiptId: live.report_receipt_id.slice(0, 8) })}
        </Text>
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

function timelineEmptyText(isLive: boolean, translate: Translate): string {
  return isLive ? translate("home.timelineListening") : translate("home.timelineEmpty");
}

export type TimelineTextStyles = {
  ltr?: StyleProp<TextStyle>;
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
  const { direction, t } = useUiLocale();
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
        <Text style={[textStyles.source, uiTextDirectionStyle(direction)]}>
          {timelineEmptyText(viewModel.isLive, t)}
        </Text>
      ) : null}
      {visibleSpans.map((span) => (
        <SpanRow
          key={`${span.span_id}:${span.revision}`}
          sourceRtl={sourceRtl}
          span={span}
          targetRtl={viewModel.targetLanguage.rtl}
          translate={t}
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
  return (
    <Text style={[textStyles.source, sourceRtl ? textStyles.rtl : textStyles.ltr ?? homeStyles.ltrText]}>
      {text}
    </Text>
  );
}

function SpanRow({
  sourceRtl,
  span,
  targetRtl,
  translate,
  textStyles,
}: {
  sourceRtl: boolean;
  span: TranslationSpan;
  targetRtl: boolean;
  translate: Translate;
  textStyles: TimelineTextStyles;
}): ReactNode {
  return (
    <View>
      <Text
        style={[
          textStyles.translation,
          isPartialSpan(span) && textStyles.partial,
          targetRtl ? textStyles.rtl : textStyles.ltr ?? homeStyles.ltrText,
        ]}
      >
        {timelineTranslationText(span, translate)}
      </Text>
      <Text style={[textStyles.source, sourceRtl ? textStyles.rtl : textStyles.ltr ?? homeStyles.ltrText]}>
        {span.source_caption}
      </Text>
    </View>
  );
}
