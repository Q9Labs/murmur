import { useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import { Image, Text, View } from "react-native";

import { failureCopy } from "../../i18n/localizedError";
import { formatUiNumber, useUiLocale } from "../../i18n/runtime";
import { phoneAudioGiftIllustration } from "../../home/illustrations";
import { ProGate } from "../proGate";
import { PrimaryAction, QuietAction, ScreenScaffold, StatusLine } from "../screenScaffold";
import { useScreenServices } from "../screenServices";
import { useScreenStyles } from "../styles";
import { phoneAudioAccess, phoneAudioGiftMinutes } from "./phoneAudioAccess";

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
    return <ProGate body={t("phoneAudio.gateBody")} title={t("capture.phoneAudio")} />;
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
