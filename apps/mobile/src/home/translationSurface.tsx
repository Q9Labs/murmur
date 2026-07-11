import type { MutableRefObject, ReactNode } from "react";
import {
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  Text,
  type TextStyle,
  View,
} from "react-native";

import type { LiveTranslationController } from "../lib/useLiveTranslation";
import type { TranslationMode } from "@murmur/protocol/transport/types";
import { styles } from "./styles";
import { ContinuousTimelineRow } from "./timeline";
import type { HomeViewModel } from "./viewModel";

const brandLogo = require("../../assets/images/icon.png");

export function TranslationSurface({
  continuousAutoScrollRef,
  continuousTimelineRef,
  continuousUserInteractedRef,
  live,
  translationMode,
  viewModel,
}: {
  continuousAutoScrollRef: MutableRefObject<boolean>;
  continuousTimelineRef: MutableRefObject<ScrollView | null>;
  continuousUserInteractedRef: MutableRefObject<boolean>;
  live: LiveTranslationController;
  translationMode: TranslationMode;
  viewModel: HomeViewModel;
}): ReactNode {
  return (
    <View style={styles.translationSurface}>
      {translationMode === "continuous" ? (
        <ContinuousTranslationSurface
          continuousAutoScrollRef={continuousAutoScrollRef}
          continuousTimelineRef={continuousTimelineRef}
          continuousUserInteractedRef={continuousUserInteractedRef}
          live={live}
          viewModel={viewModel}
        />
      ) : (
        <PhraseTranslationSurface viewModel={viewModel} />
      )}
    </View>
  );
}

function ContinuousTranslationSurface({
  continuousAutoScrollRef,
  continuousTimelineRef,
  continuousUserInteractedRef,
  live,
  viewModel,
}: {
  continuousAutoScrollRef: MutableRefObject<boolean>;
  continuousTimelineRef: MutableRefObject<ScrollView | null>;
  continuousUserInteractedRef: MutableRefObject<boolean>;
  live: LiveTranslationController;
  viewModel: HomeViewModel;
}): ReactNode {
  const onContentSizeChange = () => {
    scrollToTimelineEndIfNeeded({
      continuousAutoScrollRef,
      continuousTimelineRef,
      continuousUserInteractedRef,
    });
  };
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    updateAutoScrollFromEvent(event.nativeEvent, {
      continuousAutoScrollRef,
      continuousUserInteractedRef,
    });
  };

  return (
    <ScrollView
      contentContainerStyle={styles.continuousContent}
      onContentSizeChange={onContentSizeChange}
      onScroll={onScroll}
      onScrollBeginDrag={() => {
        continuousUserInteractedRef.current = true;
      }}
      ref={continuousTimelineRef}
      scrollEventThrottle={80}
      showsVerticalScrollIndicator
    >
      <ContinuousSurfaceHeader viewModel={viewModel} />
      <ContinuousTimelineContent live={live} viewModel={viewModel} />
      <Text style={styles.continuousFooterText}>
        Committed captions stay in this session timeline. Current partials are muted until committed.
      </Text>
    </ScrollView>
  );
}

function PhraseTranslationSurface({ viewModel }: { viewModel: HomeViewModel }): ReactNode {
  return (
    <ScrollView
      contentContainerStyle={styles.translationContent}
      showsVerticalScrollIndicator={false}
    >
      <TranslationEmptyArt visible={!viewModel.hasTranslatedText} />
      <Text style={styles.translationKicker}>
        {getPhraseTranslationKicker(viewModel)}
      </Text>
      <Text
        numberOfLines={8}
        style={getTranslatedTextStyle(viewModel)}
      >
        {viewModel.primaryCanvasText}
      </Text>
      <Text
        numberOfLines={5}
        style={getSourceTextStyle(viewModel)}
      >
        {viewModel.secondaryCanvasText}
      </Text>
    </ScrollView>
  );
}

function scrollToTimelineEndIfNeeded(params: {
  continuousAutoScrollRef: MutableRefObject<boolean>;
  continuousTimelineRef: MutableRefObject<ScrollView | null>;
  continuousUserInteractedRef: MutableRefObject<boolean>;
}): void {
  if (params.continuousAutoScrollRef.current || !params.continuousUserInteractedRef.current) {
    params.continuousTimelineRef.current?.scrollToEnd({ animated: true });
  }
}

function updateAutoScrollFromEvent(
  nativeEvent: NativeScrollEvent,
  refs: {
    continuousAutoScrollRef: MutableRefObject<boolean>;
    continuousUserInteractedRef: MutableRefObject<boolean>;
  },
): void {
  if (!refs.continuousUserInteractedRef.current) {
    return;
  }
  refs.continuousAutoScrollRef.current = distanceFromBottom(nativeEvent) < 160;
}

function distanceFromBottom(nativeEvent: NativeScrollEvent): number {
  return nativeEvent.contentSize.height -
    nativeEvent.layoutMeasurement.height -
    nativeEvent.contentOffset.y;
}

function ContinuousSurfaceHeader({ viewModel }: { viewModel: HomeViewModel }): ReactNode {
  return (
    <View style={styles.continuousHeader}>
      <Text style={styles.translationKicker}>Live translation timeline</Text>
      <Text style={styles.continuousStatus}>{getContinuousStatusText(viewModel)}</Text>
    </View>
  );
}

function getContinuousStatusText(viewModel: HomeViewModel): string {
  if (viewModel.continuousPendingCount > 0) {
    return `${viewModel.continuousPendingCount} pending`;
  }
  return viewModel.isLive ? "Live" : viewModel.statusText;
}

function ContinuousTimelineContent({
  live,
  viewModel,
}: {
  live: LiveTranslationController;
  viewModel: HomeViewModel;
}): ReactNode {
  return (
    <View style={styles.continuousTimeline}>
      <ContinuousEmptyMessage viewModel={viewModel} />
      <ContinuousRows live={live} viewModel={viewModel} />
      <TentativeSourcePanel
        caption={live.tentative_source_caption}
        sourceLanguageRtl={Boolean(viewModel.sourceLanguage?.rtl)}
      />
    </View>
  );
}

function ContinuousEmptyMessage({ viewModel }: { viewModel: HomeViewModel }): ReactNode {
  if (viewModel.hasContinuousTimeline) {
    return null;
  }
  return (
    <Text style={styles.continuousEmpty}>
      {viewModel.isLive ? "Listening. Captions will persist here." : "Tap Listen to start a continuous timeline."}
    </Text>
  );
}

function ContinuousRows({
  live,
  viewModel,
}: {
  live: LiveTranslationController;
  viewModel: HomeViewModel;
}): ReactNode {
  return live.spans.map((span) => (
    <ContinuousTimelineRow
      key={`${span.span_id}:${span.revision}`}
      sourceLanguageRtl={Boolean(viewModel.sourceLanguage?.rtl)}
      span={span}
      targetLanguageRtl={viewModel.targetLanguage.rtl}
    />
  ));
}

function TentativeSourcePanel({
  caption,
  sourceLanguageRtl,
}: {
  caption: string;
  sourceLanguageRtl: boolean;
}): ReactNode {
  if (!caption.trim()) {
    return null;
  }
  return (
    <View style={[styles.spanRow, styles.continuousSourcePanel]}>
      <Text style={[styles.spanTranslation, styles.translatedTextPartial]}>
        Listening...
      </Text>
      <Text style={getSpanSourceStyle(sourceLanguageRtl)}>{caption}</Text>
    </View>
  );
}

function getSpanSourceStyle(sourceLanguageRtl: boolean): TextStyle[] {
  const result: TextStyle[] = [styles.spanSource];
  if (sourceLanguageRtl) {
    result.push(styles.rtlText);
  }
  return result;
}

function TranslationEmptyArt({ visible }: { visible: boolean }): ReactNode {
  if (!visible) {
    return null;
  }
  return (
    <View style={styles.translationEmptyArt}>
      <View style={styles.translationEmptyHalo} />
      <Image accessibilityIgnoresInvertColors source={brandLogo} style={styles.translationEmptyLogo} />
    </View>
  );
}

function getPhraseTranslationKicker(viewModel: HomeViewModel): string {
  return viewModel.hasTranslatedText ? "Translated captions" : viewModel.statusText;
}

function getTranslatedTextStyle(viewModel: HomeViewModel): TextStyle[] {
  const result: TextStyle[] = [styles.translatedText];
  if (!viewModel.hasTranslatedText) {
    result.push(styles.emptyTranslatedText);
  }
  if (viewModel.latestTranslationIsPartial) {
    result.push(styles.translatedTextPartial);
  }
  if (shouldUseTranslatedRtlText(viewModel)) {
    result.push(styles.rtlText);
  }
  return result;
}

function shouldUseTranslatedRtlText(viewModel: HomeViewModel): boolean {
  return viewModel.hasTranslatedText && viewModel.targetLanguage.rtl;
}

function getSourceTextStyle(viewModel: HomeViewModel): TextStyle[] {
  const result: TextStyle[] = [styles.sourceText];
  if (viewModel.hasSourceText && viewModel.sourceLanguage?.rtl) {
    result.push(styles.rtlText);
  }
  return result;
}
