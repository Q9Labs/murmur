import { useRouter } from "expo-router";
import { Clock, MessagesSquare, Smartphone } from "lucide-react-native";
import { useEffect, useState, type ReactNode } from "react";
import { Alert, Image, Pressable, Text, View } from "react-native";
import { PostHogMaskView } from "posthog-react-native";

import { conversationHistoryIllustration } from "../../home/illustrations";
import type { MessageKey } from "../../i18n/catalogs/en";
import { uiTextDirectionStyle, useUiLocale, type Translate } from "../../i18n/runtime";
import { captureMobileFailure } from "../../lib/observability/sentry";
import type { HeroPoint } from "../heroPoints";
import { ProGate } from "../proGate";
import { RowGroup } from "../rowGroup";
import { ScreenScaffold, SecondaryAction, StatusLine } from "../screenScaffold";
import { type ConversationRecord, useScreenServices } from "../screenServices";
import { useScreenStyles } from "../styles";
import { conversationDetails, conversationStarted, conversationTextDirection } from "./conversationFormat";

const historyBenefits: ReadonlyArray<{ icon: HeroPoint["icon"]; text: MessageKey }> = [
  { icon: MessagesSquare, text: "history.gateRevisit" },
  { icon: Smartphone, text: "history.gateOnThisPhone" },
  { icon: Clock, text: "history.gateAlsoInPro" },
];

export function HistoryGate({ children }: { children?: ReactNode } = {}): ReactNode {
  const { t } = useUiLocale();
  return (
    <ProGate
      artwork={conversationHistoryIllustration}
      benefits={historyBenefits.map((benefit) => ({ icon: benefit.icon, text: t(benefit.text) }))}
      lead={t("history.gateLead")}
      title={t("history.gateTitle")}
    >
      {children}
    </ProGate>
  );
}

export function HistoryScreen(): ReactNode {
  const services = useScreenServices();
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
      {conversationRows ?? <EmptyHistory />}
      <StatusLine error={deleteError ? t("history.deleteFailed") : null} notice={null} />
    </ScreenScaffold>
  );
}

// A Pro listener before their first saved conversation: what will appear here, and when.
function EmptyHistory(): ReactNode {
  const { styles } = useScreenStyles();
  const { t } = useUiLocale();
  return (
    <View style={styles.emptyState}>
      <Image
        accessibilityIgnoresInvertColors
        accessible={false}
        resizeMode="contain"
        source={conversationHistoryIllustration}
        style={styles.emptyArtwork}
      />
      <Text accessibilityRole="header" style={styles.emptyTitle}>{t("history.emptyTitle")}</Text>
      <Text style={styles.emptyBody}>{t("history.empty")}</Text>
    </View>
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
