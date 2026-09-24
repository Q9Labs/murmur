import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import type { ImageSourcePropType } from "react-native";

import { useUiLocale } from "../i18n/runtime";
import { type HeroPoint, HeroPoints } from "./heroPoints";
import { PrimaryAction, QuietAction, ScreenScaffold } from "./screenScaffold";

// What a free listener sees after tapping a Pro feature: the feature pictured, what Pro gives
// them for it, and one clear way to the plans. Declining stays as easy as the back button.
export function ProGate(props: {
  artwork: ImageSourcePropType;
  benefits: readonly HeroPoint[];
  children?: ReactNode;
  lead: string;
  title: string;
}): ReactNode {
  const router = useRouter();
  const { t } = useUiLocale();
  return (
    <ScreenScaffold
      artwork={props.artwork}
      footer={(
        <>
          <PrimaryAction
            label={t("proGate.seePlans")}
            onPress={() => router.push({ params: { term: "monthly" }, pathname: "/plans" })}
          />
          <QuietAction
            label={t("proGate.notNow")}
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          />
        </>
      )}
      lead={props.lead}
      title={props.title}
    >
      <HeroPoints points={props.benefits} />
      {props.children}
    </ScreenScaffold>
  );
}
