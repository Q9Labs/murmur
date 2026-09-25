import { useRouter } from "expo-router";
import { AudioLines, Captions, Clock } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Image, Text, View } from "react-native";

import type { MessageKey } from "../../i18n/catalogs/en";
import { failureCopy } from "../../i18n/localizedError";
import { formatUiNumber, useUiLocale } from "../../i18n/runtime";
import { phoneAudioGiftIllustration, phoneAudioIllustration } from "../../home/illustrations";
import type { HeroPoint } from "../heroPoints";
import { ProGate } from "../proGate";
import { PrimaryAction, QuietAction, ScreenScaffold, StatusLine } from "../screenScaffold";
import { useScreenServices } from "../screenServices";
import { useScreenStyles } from "../styles";
import { phoneAudioAccess, phoneAudioGiftMinutes } from "./phoneAudioAccess";

const phoneAudioBenefits: ReadonlyArray<{ icon: HeroPoint["icon"]; text: MessageKey }> = [
  { icon: AudioLines, text: "phoneAudio.gateDirect" },
  { icon: Captions, text: "phoneAudio.gateCaptions" },
  { icon: Clock, text: "phoneAudio.gateAlsoInPro" },
];

export function PhoneAudioScreen(): ReactNode {
  const router = useRouter();
  const services = useScreenServices();
  const { styles } = useScreenStyles();
  const ui = useUiLocale();
  const { t } = ui;
  const phoneAudioBody = t("phoneAudio.body");
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const access = phoneAudioAccess(services.features, services.phoneAudioGift);
  const usePhoneAudio = () => router.dismissTo({ params: { capture: "phone-audio" }, pathname: "/" });

  if (access === "locked") {
    return (
      <ProGate
        artwork={phoneAudioIllustration}
        benefits={phoneAudioBenefits.map((benefit) => ({ icon: benefit.icon, text: t(benefit.text) }))}
        lead={t("phoneAudio.gateLead")}
        title={t("phoneAudio.gateTitle")}
      />
    );
  }

  if (access === "gift_claimable") {
    const claim = () => {
      setClaiming(true);
      setError(null);
      services.claimPhoneAudioGift()
        .catch((failure: unknown) => {
          setError(failureCopy(failure, ui, "phoneAudio.claimFailed"));
        })
        .finally(() => setClaiming(false));
    };
    return (
      <ScreenScaffold
        footer={(
          <>
            <PrimaryAction
              disabled={claiming}
              label={claiming ? t("phoneAudio.claiming") : t("phoneAudio.claim", { minutes: formatUiNumber(phoneAudioGiftMinutes, ui.locale) })}
              onPress={claim}
            />
            <QuietAction label={t("phoneAudio.notNow")} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
          </>
        )}
        title={t("phoneAudio.giftTitle")}
      >
        <View style={styles.giftCard}>
          <GiftIllustration />
          <Text style={styles.bodyStrong}>{t("phoneAudio.giftHeadline", { minutes: formatUiNumber(phoneAudioGiftMinutes, ui.locale) })}</Text>
          <Text style={styles.body}>{phoneAudioBody}</Text>
        </View>
        <StatusLine error={error} notice={null} />
      </ScreenScaffold>
    );
  }

  const giftMinutes = Math.ceil(services.phoneAudioGift.remainingMs / 60_000);
  return (
    <ScreenScaffold
      footer={<PrimaryAction label={t("phoneAudio.use")} onPress={usePhoneAudio} />}
      title={t(access === "gift_active" ? "phoneAudio.yours" : "capture.phoneAudio")}
    >
      {access === "gift_active" ? (
        <View style={styles.giftCard}>
          <GiftIllustration />
          <Text style={styles.bodyStrong}>{t(giftMinutes === 1 ? "phoneAudio.oneMinuteLeft" : "phoneAudio.minutesLeft", { minutes: formatUiNumber(giftMinutes, ui.locale) })}</Text>
          <Text style={styles.body}>{phoneAudioBody}</Text>
        </View>
      ) : <Text style={styles.body}>{phoneAudioBody}</Text>}
    </ScreenScaffold>
  );
}

function GiftIllustration(): ReactNode {
  const { styles } = useScreenStyles();
  return (
    <Image
      accessibilityIgnoresInvertColors
      accessible={false}
      resizeMode="contain"
      source={phoneAudioGiftIllustration}
      style={styles.illustration}
    />
  );
}
