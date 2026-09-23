import { useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import { Alert, Share, Text, View } from "react-native";

import { ProGate } from "../proGate";
import { PrimaryAction, ScreenScaffold, SecondaryAction, StatusLine } from "../screenScaffold";
import { type ConversationRecord, useScreenServices } from "../screenServices";
import { useScreenStyles } from "../styles";
import { conversationDetails, conversationStarted } from "./conversationFormat";
import { historyGate } from "./historyScreen";

type Feedback = { error: string | null; notice: string | null };

export function ConversationScreen({ id }: { id: string | undefined }): ReactNode {
  const services = useScreenServices();
  const { styles } = useScreenStyles();
  const record = services.conversations.find((candidate) => candidate.id === id);
  if (!services.features.history) {
    return <ProGate body={historyGate.body} title={historyGate.title} />;
  }
  if (!record) {
    return (
      <ScreenScaffold title="Conversation">
        <Text style={styles.body}>This conversation is no longer on this phone.</Text>
      </ScreenScaffold>
    );
  }
  return <ConversationDetail record={record} />;
}

function ConversationDetail({ record }: { record: ConversationRecord }): ReactNode {
  const router = useRouter();
  const services = useScreenServices();
  const { styles } = useScreenStyles();
  const [feedback, setFeedback] = useState<Feedback>({ error: null, notice: null });
  const fail = (message: string) => setFeedback({ error: message, notice: null });

  const share = () => {
    Share.share({ message: record.text }).catch(() => fail("Sharing didn't open. Try again."));
  };
  const copy = () => {
    import("expo-clipboard")
      .then((clipboard) => clipboard.setStringAsync(record.text))
      .then(() => setFeedback({ error: null, notice: "Copied." }))
      .catch(() => fail("Copying didn't work. Try again."));
  };
  const remove = () => {
    services.deleteConversation(record.id)
      .then(() => (router.canGoBack() ? router.back() : router.replace("/history")))
      .catch(() => fail("The conversation wasn't deleted. Try again."));
  };

  return (
    <ScreenScaffold
      footer={(
        <>
          <PrimaryAction label="Share" onPress={share} />
          <View style={styles.choiceRow}>
            <View style={styles.choice}>
              <SecondaryAction label="Copy" onPress={copy} />
            </View>
            <View style={styles.choice}>
              <SecondaryAction label="Delete" onPress={() => confirmDelete(remove)} />
            </View>
          </View>
        </>
      )}
      title={conversationStarted(record)}
    >
      <Text style={styles.conversationMeta}>{conversationDetails(record)}</Text>
      <Text selectable style={styles.conversationText}>{record.text}</Text>
      <StatusLine error={feedback.error} notice={feedback.notice} />
    </ScreenScaffold>
  );
}

function confirmDelete(remove: () => void): void {
  Alert.alert("Delete this conversation?", "It's removed from this phone for good.", [
    { style: "cancel", text: "Keep" },
    { onPress: remove, style: "destructive", text: "Delete" },
  ]);
}
