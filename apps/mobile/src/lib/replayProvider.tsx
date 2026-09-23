import { useEffect, useState, type ReactNode } from "react";
import { PostHog, PostHogProvider } from "posthog-react-native";

import { initializeReplay, subscribeReplay } from "./replay";

export function ReplayProvider({ children }: { children: ReactNode }): ReactNode {
  const [client, setClient] = useState<PostHog | null>(null);
  useEffect(() => {
    let active = true;
    void initializeReplay().then((replay) => {
      if (active) setClient(replay);
    });
    const unsubscribe = subscribeReplay((replay) => {
      if (active) setClient(replay);
    });
    return () => { active = false; unsubscribe(); };
  }, []);
  return client
    ? <PostHogProvider client={client} autocapture={false}>{children}</PostHogProvider>
    : children;
}
