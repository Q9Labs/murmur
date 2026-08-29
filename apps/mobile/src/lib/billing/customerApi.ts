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
  trigger: "purchase" | "restore",
): Promise<void> {
  const response = await requestMurmurReconciliation(trigger);
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    throw new Error(
      readCustomerError(payload) ?? `Murmur purchase verification failed (${response.status}).`,
    );
  }
}
