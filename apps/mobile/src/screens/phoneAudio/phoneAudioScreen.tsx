import { useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import { Image, Text, View } from "react-native";

import { phoneAudioGiftIllustration } from "../../home/illustrations";
import { ProGate } from "../proGate";
import { PrimaryAction, QuietAction, ScreenScaffold, StatusLine } from "../screenScaffold";
import { useScreenServices } from "../screenServices";
import { useScreenStyles } from "../styles";
import { phoneAudioAccess, phoneAudioGiftMinutes } from "./phoneAudioAccess";

const phoneAudioBody = "Translate videos, calls and podcasts playing on this phone.";

export function PhoneAudioScreen(): ReactNode {
  const router = useRouter();
  const services = useScreenServices();
  const { styles } = useScreenStyles();
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const access = phoneAudioAccess(services.features, services.phoneAudioGift);
  const usePhoneAudio = () => router.dismissTo({ params: { capture: "phone-audio" }, pathname: "/" });

  if (access === "locked") {
    return <ProGate body={`${phoneAudioBody} Phone audio is part of Pro.`} title="Phone audio" />;
  }

  if (access === "gift_claimable") {
    const claim = () => {
      setClaiming(true);
      setError(null);
      services.claimPhoneAudioGift()
        .catch((failure: unknown) => {
          setError(failure instanceof Error ? failure.message : "The gift couldn't be claimed. Try again.");
        })
        .finally(() => setClaiming(false));
    };
    return (
      <ScreenScaffold
        footer={(
          <>
            <PrimaryAction
              disabled={claiming}
              label={claiming ? "Claiming…" : `Claim ${phoneAudioGiftMinutes} free minutes`}
              onPress={claim}
            />
            <QuietAction label="Not now" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
          </>
        )}
        title="A gift for you"
      >
        <View style={styles.giftCard}>
          <GiftIllustration />
          <Text style={styles.bodyStrong}>{`${phoneAudioGiftMinutes} minutes of Phone audio, free`}</Text>
          <Text style={styles.body}>{phoneAudioBody}</Text>
        </View>
        <StatusLine error={error} notice={null} />
      </ScreenScaffold>
    );
  }

  const giftMinutes = Math.ceil(services.phoneAudioGift.remainingMs / 60_000);
  return (
    <ScreenScaffold
      footer={<PrimaryAction label="Use Phone audio" onPress={usePhoneAudio} />}
      title={access === "gift_active" ? "Phone audio is yours" : "Phone audio"}
    >
      {access === "gift_active" ? (
        <View style={styles.giftCard}>
          <GiftIllustration />
          <Text style={styles.bodyStrong}>{`${giftMinutes} free ${giftMinutes === 1 ? "minute" : "minutes"} left`}</Text>
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
