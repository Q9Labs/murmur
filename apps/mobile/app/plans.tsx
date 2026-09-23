import { useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";

import { planTermFromParam, PlansScreen } from "../src/screens/plans/plansScreen";

export default function PlansRoute(): ReactNode {
  const { term } = useLocalSearchParams<{ term?: string | string[] }>();
  return <PlansScreen initialTerm={planTermFromParam(term)} />;
}
