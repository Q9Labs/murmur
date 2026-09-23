import { Share } from "react-native";

import type { Translate } from "../i18n/runtime";

const referralUrl =
  "https://murmur.q9labs.ai/?utm_source=murmur-app&utm_medium=referral&utm_campaign=organic-share";

export async function shareMurmur(t: Translate): Promise<void> {
  await Share.share({
    message: t("share.message", { url: referralUrl }),
    title: t("share.title"),
    url: referralUrl,
  });
}
