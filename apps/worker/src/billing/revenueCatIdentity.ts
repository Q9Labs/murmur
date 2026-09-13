import type { Env } from "../env";
import type { RevenueCatEvent } from "./revenueCatEvent";

const namespacePattern = /^[a-z0-9][a-z0-9_-]{0,31}$/;

export function revenueCatCustomerId(env: Env, customerId: string): string {
  const namespace = customerNamespace(env);
  return namespace ? `${namespace}:${customerId}` : customerId;
}

function localCustomerId(env: Env, revenueCatId: string): string | null {
  const namespace = customerNamespace(env);
  if (!namespace) {
    return revenueCatId;
  }
  const prefix = `${namespace}:`;
  return revenueCatId.startsWith(prefix) && revenueCatId.length > prefix.length
    ? revenueCatId.slice(prefix.length)
    : null;
}

export function localizeRevenueCatEvent(env: Env, event: RevenueCatEvent): RevenueCatEvent | null {
  const appUserId = localCustomerId(env, event.appUserId);
  const originalAppUserId = localCustomerId(env, event.originalAppUserId);
  if (!appUserId || !originalAppUserId) {
    return null;
  }
  return {
    ...event,
    aliases: event.aliases.flatMap((alias) => {
      const localized = localCustomerId(env, alias);
      return localized ? [localized] : [];
    }),
    appUserId,
    originalAppUserId,
  };
}

function customerNamespace(env: Env): string | null {
  const namespace = env.REVENUECAT_CUSTOMER_NAMESPACE?.trim();
  if (!namespace) {
    return null;
  }
  if (!namespacePattern.test(namespace)) {
    throw new Error("invalid RevenueCat customer namespace");
  }
  return namespace;
}
