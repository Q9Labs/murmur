import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Text } from "react-native";

import { useUiLocale } from "../i18n/runtime";
import { PrimaryAction, ScreenScaffold } from "./screenScaffold";
import { useScreenStyles } from "./styles";

// What a free listener sees in place of a Pro feature: what it does, and the way to get it.
export function ProGate(props: { body: string; title: string }): ReactNode {
  const router = useRouter();
  const { styles } = useScreenStyles();
  const { t } = useUiLocale();
  return (
    <ScreenScaffold
      footer={(
        <PrimaryAction
          label={t("proGate.seePlans")}
          onPress={() => router.push({ params: { term: "monthly" }, pathname: "/plans" })}
        />
      )}
      title={props.title}
    >
      <Text style={styles.body}>{props.body}</Text>
    </ScreenScaffold>
  );
}
