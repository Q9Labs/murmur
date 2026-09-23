import { useRouter } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { PostHogMaskView } from "posthog-react-native";

import { uiTextDirectionStyle, useUiLocale, type Translate } from "../../i18n/runtime";
import { captureMobileFailure } from "../../lib/observability/sentry";
import { ProGate } from "../proGate";
import { RowGroup } from "../rowGroup";
import { ScreenScaffold, SecondaryAction, StatusLine } from "../screenScaffold";
import { type ConversationRecord, useScreenServices } from "../screenServices";
import { useScreenStyles } from "../styles";
import { conversationDetails, conversationStarted, conversationTextDirection } from "./conversationFormat";

export function HistoryGate({ children }: { children?: ReactNode } = {}): ReactNode {
  const { t } = useUiLocale();
  return <ProGate body={t("history.gateBody")} title={t("history.gateTitle")}>{children}</ProGate>;
}

export function HistoryScreen(): ReactNode {
  const services = useScreenServices();
  const { styles } = useScreenStyles();
  const { t } = useUiLocale();
  const [deleteError, setDeleteError] = useState(false);
  const { reloadConversations } = services;
  useEffect(() => {
    reloadConversations().catch((failure: unknown) => {
      captureMobileFailure(failure, { operation: "load_conversation_history" });
    });
  }, [reloadConversations]);
  const conversations = [...services.conversations].sort((first, second) => second.startedAtMs - first.startedAtMs);
  const conversationRows = conversations.length > 0 ? (
    <RowGroup>
      {conversations.map((record) => (
        <ConversationRow
          key={record.id}
          onDelete={() => removeConversation(record.id, services.deleteConversation, setDeleteError)}
          record={record}
        />
      ))}
    </RowGroup>
  ) : null;
  if (!services.features.history) {
    return (
      <HistoryGate>
        {conversationRows}
        <StatusLine error={deleteError ? t("history.deleteFailed") : null} notice={null} />
      </HistoryGate>
    );
  }
  return (
    <ScreenScaffold title={t("history.title")}>
      {conversationRows ?? <Text style={styles.body}>{t("history.empty")}</Text>}
      <StatusLine error={deleteError ? t("history.deleteFailed") : null} notice={null} />
    </ScreenScaffold>
  );
}

function ConversationRow({
  onDelete,
  record,
}: {
  onDelete: () => void;
  record: ConversationRecord;
}): ReactNode {
  const router = useRouter();
  const { styles } = useScreenStyles();
  const ui = useUiLocale();
  const started = conversationStarted(record, ui);
  const details = conversationDetails(record, ui);
  return (
    <View>
      {record.canView ? (
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
      ) : (
        <Text style={styles.conversationMeta}>{`${started} · ${details}`}</Text>
      )}
      {!record.canView ? <SecondaryAction label={ui.t("history.delete")} onPress={() => confirmDelete(onDelete, ui.t)} /> : null}
    </View>
  );
}

function removeConversation(
  id: string,
  remove: (id: string) => Promise<void>,
  setDeleteError: (failed: boolean) => void,
): void {
  const onDelete = () => {
    setDeleteError(false);
    remove(id).catch((failure: unknown) => {
      captureMobileFailure(failure, { operation: "delete_conversation" });
      setDeleteError(true);
    });
  };
  onDelete();
}

export function confirmDelete(remove: () => void, t: Translate): void {
  Alert.alert(t("history.deleteTitle"), t("history.deleteBody"), [
    { style: "cancel", text: t("history.keep") },
    { onPress: remove, style: "destructive", text: t("history.delete") },
  ]);
}
