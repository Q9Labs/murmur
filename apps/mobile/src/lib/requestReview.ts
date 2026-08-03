import * as StoreReview from "expo-store-review";

export async function requestMurmurReview(): Promise<boolean> {
  try {
    if (!(await StoreReview.isAvailableAsync())) {
      return false;
    }
    await StoreReview.requestReview();
    return true;
  } catch {
    return false;
  }
}
