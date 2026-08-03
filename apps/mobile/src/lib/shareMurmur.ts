import { Share } from "react-native";

const referralUrl =
  "https://murmur.q9labs.ai/?utm_source=murmur-app&utm_medium=referral&utm_campaign=organic-share";

export async function shareMurmur(): Promise<void> {
  await Share.share({
    message:
      `Follow tours and talks in another language with live translated captions. ${referralUrl}`,
    title: "Murmur: Live Voice Translator",
    url: referralUrl,
  });
}
