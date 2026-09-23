import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { failureCopy } from "../../i18n/localizedError";
import { useUiLocale } from "../../i18n/runtime";
import type { MurmurPlan } from "../../lib/billing/planCatalog";
import { usePlanStyles } from "./styles";

export type PlanListState =
  | { status: "loading" }
  | { plans: MurmurPlan[]; status: "ready" }
  | { failure: unknown; status: "failed" };

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
        setPlans({ failure, status: "failed" });
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
  const ui = useUiLocale();
  if (props.plans.status === "loading") {
    return <Text accessibilityLiveRegion="polite" style={styles.status}>{ui.t("plans.loading")}</Text>;
  }
  if (props.plans.status === "failed") {
    return (
      <View style={styles.picker}>
        <Text style={styles.statusError}>{failureCopy(props.plans.failure, ui, "plans.unavailable")}</Text>
        <Pressable
          accessibilityLabel={ui.t("plans.retryLabel")}
          accessibilityRole="button"
          onPress={props.onRetry}
          style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
        >
          <Text style={styles.retryText}>{ui.t("common.tryAgain")}</Text>
        </Pressable>
      </View>
    );
  }
  return <Text style={styles.status}>{ui.t("plans.empty")}</Text>;
}
