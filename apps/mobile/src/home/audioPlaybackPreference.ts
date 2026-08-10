import { deleteLocalValue, getLocalValue, setLocalValue } from "../lib/localStorage";

const audioPlaybackStorageId = "murmur_audio_playback_v1";

export async function getStoredAudioPlaybackEnabled(): Promise<boolean> {
  return (await getLocalValue(audioPlaybackStorageId)) !== "disabled";
}

export async function setStoredAudioPlaybackEnabled(enabled: boolean): Promise<void> {
  await setLocalValue(audioPlaybackStorageId, enabled ? "enabled" : "disabled");
}

export async function deleteStoredAudioPlaybackEnabled(): Promise<void> {
  await deleteLocalValue(audioPlaybackStorageId);
}
