import { useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import { Alert, Text, View } from "react-native";
import { PostHogMaskView } from "posthog-react-native";

import { uiTextDirectionStyle, useUiLocale, type Translate } from "../../i18n/runtime";
import { PrimaryAction, ScreenScaffold, SecondaryAction, StatusLine } from "../screenScaffold";
import { type ConversationRecord, useScreenServices } from "../screenServices";
import { useScreenStyles } from "../styles";
import { conversationDetails, conversationStarted, conversationTextDirection } from "./conversationFormat";
import { HistoryGate } from "./historyScreen";

type Feedback = { error: string | null; notice: string | null };

export function ConversationScreen({ id }: { id: string | undefined }): ReactNode {
  const services = useScreenServices();
  const { styles } = useScreenStyles();
  const { t } = useUiLocale();
  const record = services.conversations.find((candidate) => candidate.id === id);
  if (!services.features.history) {
    return <HistoryGate />;
  }
  if (!record) {
    return (
      <ScreenScaffold title={t("history.conversationTitle")}>
        <Text style={styles.body}>{t("history.missing")}</Text>
      </ScreenScaffold>
    );
  }
  return <ConversationDetail record={record} />;
}

function ConversationDetail({ record }: { record: ConversationRecord }): ReactNode {
  const router = useRouter();
  const services = useScreenServices();
  const { styles } = useScreenStyles();
  const ui = useUiLocale();
  const { t } = ui;
  const [feedback, setFeedback] = useState<Feedback>({ error: null, notice: null });
  const fail = (message: string) => setFeedback({ error: message, notice: null });

  const share = () => {
    services.shareConversation(record.id).catch(() => fail(t("history.shareFailed")));
  };
  const copy = () => {
    import("expo-clipboard")
      .then((clipboard) => clipboard.setStringAsync(record.text))
      .then(() => setFeedback({ error: null, notice: t("history.copied") }))
      .catch(() => fail(t("history.copyFailed")));
  };
  const remove = () => {
    services.deleteConversation(record.id)
      .then(() => (router.canGoBack() ? router.back() : router.replace("/history")))
      .catch(() => fail(t("history.deleteFailed")));
  };

  return (
    <ScreenScaffold
      footer={(
        <>
          <PrimaryAction label={t("history.share")} onPress={share} />
          <View style={styles.choiceRow}>
            <View style={styles.choice}>
              <SecondaryAction label={t("history.copy")} onPress={copy} />
            </View>
            <View style={styles.choice}>
              <SecondaryAction label={t("history.delete")} onPress={() => confirmDelete(remove, t)} />
            </View>
          </View>
        </>
      )}
      title={conversationStarted(record, ui)}
    >
      <Text style={styles.conversationMeta}>{conversationDetails(record, ui)}</Text>
      <PostHogMaskView>
        <Text
          selectable
          style={[styles.conversationText, uiTextDirectionStyle(conversationTextDirection(record), ui.direction)]}
        >
          {record.text}
        </Text>
      </PostHogMaskView>
      <StatusLine error={feedback.error} notice={feedback.notice} />
    </ScreenScaffold>
  );
}

function confirmDelete(remove: () => void, t: Translate): void {
  Alert.alert(t("history.deleteTitle"), t("history.deleteBody"), [
    { style: "cancel", text: t("history.keep") },
    { onPress: remove, style: "destructive", text: t("history.delete") },
  ]);
}
