import { useRouter } from "expo-router";
import { useEffect, type ReactNode } from "react";
import { Pressable, Text } from "react-native";
import { PostHogMaskView } from "posthog-react-native";

import { uiTextDirectionStyle, useUiLocale } from "../../i18n/runtime";
import { captureMobileFailure } from "../../lib/observability/sentry";
import { ProGate } from "../proGate";
import { RowGroup } from "../rowGroup";
import { ScreenScaffold } from "../screenScaffold";
import { type ConversationRecord, useScreenServices } from "../screenServices";
import { useScreenStyles } from "../styles";
import { conversationDetails, conversationStarted, conversationTextDirection } from "./conversationFormat";

export function HistoryGate(): ReactNode {
  const { t } = useUiLocale();
  return <ProGate body={t("history.gateBody")} title={t("history.gateTitle")} />;
}

export function HistoryScreen(): ReactNode {
  const services = useScreenServices();
  const { styles } = useScreenStyles();
  const { t } = useUiLocale();
  const { reloadConversations } = services;
  useEffect(() => {
    reloadConversations().catch((failure: unknown) => {
      captureMobileFailure(failure, { operation: "load_conversation_history" });
    });
  }, [reloadConversations]);
  if (!services.features.history) {
    return <HistoryGate />;
  }
  const conversations = [...services.conversations].sort((first, second) => second.startedAtMs - first.startedAtMs);
  return (
    <ScreenScaffold title={t("history.title")}>
      {conversations.length === 0 ? (
        <Text style={styles.body}>{t("history.empty")}</Text>
      ) : (
        <RowGroup>
          {conversations.map((record) => <ConversationRow key={record.id} record={record} />)}
        </RowGroup>
      )}
    </ScreenScaffold>
  );
}

function ConversationRow({ record }: { record: ConversationRecord }): ReactNode {
  const router = useRouter();
  const { styles } = useScreenStyles();
  const ui = useUiLocale();
  const started = conversationStarted(record, ui);
  const details = conversationDetails(record, ui);
  return (
    <Pressable
      accessibilityHint={ui.t("history.openHint")}
      accessibilityLabel={`${started}, ${details}. ${record.text}`}
      accessibilityRole="button"
      onPress={() => router.push({ params: { id: record.id }, pathname: "/history/[id]" })}
      style={({ pressed }) => [styles.conversationRow, pressed && styles.pressed]}
    >
      <PostHogMaskView>
        <Text
          numberOfLines={2}
          style={[styles.conversationExcerpt, uiTextDirectionStyle(conversationTextDirection(record), ui.direction)]}
        >
          {record.text}
        </Text>
      </PostHogMaskView>
      <Text style={styles.conversationMeta}>{`${started} · ${details}`}</Text>
    </Pressable>
  );
}
