import { LocalizedError } from "../i18n/localizedError";
import { deleteLocalValue, getLocalValue, setLocalValue } from "./localStorage";
import { updateWorkerInsightsConsent } from "./providers/insightsWorker";
import { withWriteDeadline } from "./writeDeadline";

const legacyStorageKey = "murmur_insights_consent_v1";
const storageKey = "murmur_insights_consent_v2";

export async function getInsightsConsent(): Promise<boolean | null> {
  const stored = await getLocalValue(storageKey);
  return stored === "true" ? true : stored === "false" ? false : null;
}

export async function setInsightsConsent(consent: boolean): Promise<void> {
  await updateWorkerInsightsConsent(consent);
  // A storage write that never settles (missing platform entitlement) must
  // not leave the consent screen pending forever; fail closed as saveFailed.
  await withWriteDeadline(
    setLocalValue(storageKey, String(consent)),
    () => new LocalizedError("insights.saveFailed"),
  );
}

export async function deleteInsightsConsent(): Promise<void> {
  await deleteLocalValue(legacyStorageKey);
  await deleteLocalValue(storageKey);
}
