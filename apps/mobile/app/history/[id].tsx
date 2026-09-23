import { useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";

import { ConversationScreen } from "../../src/screens/history/conversationScreen";

export default function ConversationRoute(): ReactNode {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  return <ConversationScreen id={Array.isArray(id) ? id[0] : id} />;
}
