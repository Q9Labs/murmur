import { deleteLocalValue, getLocalValue, setLocalValue } from "./localStorage";

// The Phone audio gift is offered after a session once; after that it waits in Home's
// Phone audio option, so an unclaimed gift never holds back the rating.
const storageKey = "murmur_phone_audio_gift_offered_v1";

export async function hasOfferedPhoneAudioGift(): Promise<boolean> {
  return (await getLocalValue(storageKey)) === "true";
}

export async function markPhoneAudioGiftOffered(): Promise<void> {
  await setLocalValue(storageKey, "true");
}

export async function deletePhoneAudioGiftOffer(): Promise<void> {
  await deleteLocalValue(storageKey);
}
