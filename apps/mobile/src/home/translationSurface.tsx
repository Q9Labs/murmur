import type { ReactNode } from "react";
import { View } from "react-native";

import { styles } from "./styles";
import { SpanTimeline } from "./variants/shared";
import type { VariantShellProps } from "./variants/types";

export function TranslationSurface({
  autoScrollRef,
  live,
  timelineRef,
  userInteractedRef,
  viewModel,
}: Pick<
  VariantShellProps,
  "autoScrollRef" | "live" | "timelineRef" | "userInteractedRef" | "viewModel"
>): ReactNode {
  return (
    <View style={styles.translationSurface}>
      <SpanTimeline
        autoScrollRef={autoScrollRef}
        contentStyle={styles.timelineContent}
        live={live}
        style={styles.timelineScroll}
        textStyles={{
          partial: styles.translatedTextPartial,
          rtl: styles.rtlText,
          source: styles.spanSource,
          translation: styles.spanTranslation,
        }}
        timelineRef={timelineRef}
        userInteractedRef={userInteractedRef}
        viewModel={viewModel}
      />
    </View>
  );
}
