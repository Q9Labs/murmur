import { deleteLocalValue, getLocalValue, setLocalValue } from "./localStorage";
import { updateWorkerInsightsConsent } from "./providers/insightsWorker";

const storageKey = "murmur_insights_consent_v1";

export async function getInsightsConsent(): Promise<boolean | null> {
  const stored = await getLocalValue(storageKey);
  return stored === "true" ? true : stored === "false" ? false : null;
}

export async function setInsightsConsent(consent: boolean): Promise<void> {
  await updateWorkerInsightsConsent(consent);
  await setLocalValue(storageKey, String(consent));
}

export async function deleteInsightsConsent(): Promise<void> {
  await deleteLocalValue(storageKey);
}
