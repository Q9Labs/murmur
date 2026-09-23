import { useRouter } from "expo-router";
import { useEffect, type ReactNode } from "react";
import { Pressable, Text } from "react-native";

import { captureMobileFailure } from "../../lib/observability/sentry";
import { ProGate } from "../proGate";
import { RowGroup } from "../rowGroup";
import { ScreenScaffold } from "../screenScaffold";
import { type ConversationRecord, useScreenServices } from "../screenServices";
import { useScreenStyles } from "../styles";
import { conversationDetails, conversationStarted } from "./conversationFormat";

export const historyGate = {
  body: "Keep your translations on this phone to read, copy or share later. History is part of Pro.",
  title: "Conversation history",
} as const;

export function HistoryScreen(): ReactNode {
  const services = useScreenServices();
  const { styles } = useScreenStyles();
  const { reloadConversations } = services;
  useEffect(() => {
    reloadConversations().catch((failure: unknown) => {
      captureMobileFailure(failure, { operation: "load_conversation_history" });
    });
  }, [reloadConversations]);
  if (!services.features.history) {
    return <ProGate body={historyGate.body} title={historyGate.title} />;
  }
  const conversations = [...services.conversations].sort((first, second) => second.startedAtMs - first.startedAtMs);
  return (
    <ScreenScaffold title="History">
      {conversations.length === 0 ? (
        <Text style={styles.body}>Your conversations will be saved here, on this phone only.</Text>
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
  const started = conversationStarted(record);
  const details = conversationDetails(record);
  return (
    <Pressable
      accessibilityHint="Opens the conversation"
      accessibilityLabel={`${started}, ${details}. ${record.text}`}
      accessibilityRole="button"
      onPress={() => router.push({ params: { id: record.id }, pathname: "/history/[id]" })}
      style={({ pressed }) => [styles.conversationRow, pressed && styles.pressed]}
    >
      <Text numberOfLines={2} style={styles.conversationExcerpt}>{record.text}</Text>
      <Text style={styles.conversationMeta}>{`${started} · ${details}`}</Text>
    </Pressable>
  );
}
