import { getDevTranslationModelRouteEnv } from "../../lib/config";
import {
  defaultTranslationModelRoute,
  isTranslationModelRoute,
} from "../../lib/translationModelRoutes";
import type { TranslationModelRoute } from "../../lib/transport/types";

export function isDevModelPickerEnabled(): boolean {
  return typeof __DEV__ !== "undefined" && __DEV__;
}

export function getInitialDevModelRoute(): TranslationModelRoute {
  const configuredRoute = getDevTranslationModelRouteEnv();
  return isTranslationModelRoute(configuredRoute)
    ? configuredRoute
    : defaultTranslationModelRoute;
}
