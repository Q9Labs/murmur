import { useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";

import { planIdFromParam, SignInScreen } from "../src/screens/auth/signInScreen";

export default function SignInRoute(): ReactNode {
  const { plan } = useLocalSearchParams<{ plan?: string | string[] }>();
  return <SignInScreen planId={planIdFromParam(plan)} />;
}
