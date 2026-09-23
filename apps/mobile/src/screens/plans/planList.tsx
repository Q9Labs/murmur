import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import type { MurmurPlan } from "../../lib/billing/planCatalog";
import { usePlanStyles } from "./styles";

export type PlanListState =
  | { status: "loading" }
  | { plans: MurmurPlan[]; status: "ready" }
  | { message: string; status: "failed" };

export function usePlanList(
  open: boolean,
  loadPlans: () => Promise<MurmurPlan[]>,
): { plans: PlanListState; refresh: () => void } {
  const [plans, setPlans] = useState<PlanListState>({ status: "loading" });

  const refresh = useCallback(() => {
    setPlans({ status: "loading" });
    loadPlans()
      .then((nextPlans) => setPlans({ plans: nextPlans, status: "ready" }))
      .catch((failure: unknown) => {
        setPlans({
          message: failure instanceof Error
            ? failure.message
            : "Plans are not available from the store right now.",
          status: "failed",
        });
      });
  }, [loadPlans]);

  useEffect(() => {
    if (open) {
      refresh();
    }
  }, [open, refresh]);

  return { plans, refresh };
}

// Shown instead of the picker while plans load, fail, or come back empty.
export function PlanListStatus(props: { onRetry: () => void; plans: PlanListState }): ReactNode {
  const { styles } = usePlanStyles();
  if (props.plans.status === "loading") {
    return <Text accessibilityLiveRegion="polite" style={styles.status}>Loading plans…</Text>;
  }
  if (props.plans.status === "failed") {
    return (
      <View style={styles.picker}>
        <Text style={styles.statusError}>{props.plans.message}</Text>
        <Pressable
          accessibilityLabel="Try loading plans again"
          accessibilityRole="button"
          onPress={props.onRetry}
          style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
        >
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
  return <Text style={styles.status}>No plans are available from the store right now.</Text>;
}
