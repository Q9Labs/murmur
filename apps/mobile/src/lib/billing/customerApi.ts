import {
  requestMurmurCustomer,
  requestMurmurReconciliation,
} from "../providers/murmurBillingApi";
import { decodeCustomer, readCustomerError, type MurmurCustomer } from "./customerResponse";

export async function fetchMurmurCustomer(): Promise<MurmurCustomer> {
  const response = await requestMurmurCustomer();
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      readCustomerError(payload) ?? `Murmur account request failed (${response.status}).`,
    );
  }
  const customer = decodeCustomer(payload);
  if (!customer) {
    throw new Error("Murmur returned an invalid account response.");
  }
  return customer;
}

export async function reconcileMurmurCustomer(
  trigger: "login" | "purchase" | "restore",
): Promise<{ purchaseCount: number; subscriptionCount: number }> {
  const response = await requestMurmurReconciliation(trigger);
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      readCustomerError(payload) ?? `Murmur purchase verification failed (${response.status}).`,
    );
  }
  const purchaseCount = typeof payload === "object" && payload !== null
    ? Reflect.get(payload, "purchase_count")
    : null;
  const subscriptionCount = typeof payload === "object" && payload !== null
    ? Reflect.get(payload, "subscription_count")
    : null;
  if (!Number.isInteger(purchaseCount) || !Number.isInteger(subscriptionCount)) {
    throw new Error("Murmur returned an invalid purchase verification response.");
  }
  return {
    purchaseCount: purchaseCount as number,
    subscriptionCount: subscriptionCount as number,
  };
}
