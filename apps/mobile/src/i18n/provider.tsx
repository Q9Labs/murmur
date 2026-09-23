import { useLocales } from "expo-localization";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { View } from "react-native";

import { captureMobileFailure } from "../lib/observability/sentry";
import {
  createTranslator,
  uiContentDirectionStyle,
  UiLocaleContext,
  useUiLocale,
  type UiLocaleContextValue,
} from "./runtime";
import {
  deleteStoredUiLocalePreference,
  getStoredUiLocalePreference,
  setStoredUiLocalePreference,
} from "./storage";
import {
  directionForLocale,
  isUiLocalePreference,
  resolveUiLocale,
  type UiLocale,
  type UiLocalePreference,
} from "./types";

type DocumentLocaleRoot = { dir: string; lang: string };

export function syncDocumentLocale(locale: UiLocale, root: DocumentLocaleRoot): void {
  root.lang = locale;
  root.dir = directionForLocale(locale);
}

export function UiLocaleProvider({ children }: { children: ReactNode }): ReactNode {
  const deviceLocales = useLocales();
  const [preference, setPreferenceState] = useState<UiLocalePreference>("system");
  const [ready, setReady] = useState(false);
  const mountedRef = useRef(false);
  const persistedPreferenceRef = useRef<UiLocalePreference>("system");
  const requestVersionRef = useRef(0);
  const operationQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    mountedRef.current = true;
    let active = true;
    getStoredUiLocalePreference()
      .then((storedPreference) => {
        if (active) {
          persistedPreferenceRef.current = storedPreference;
          setPreferenceState(storedPreference);
        }
      }, (failure: unknown) => {
        // The saved choice is unreadable: report it and follow the device language.
        captureMobileFailure(failure, { operation: "restore_ui_locale", stage: "i18n" });
      })
      .finally(() => {
        if (active) {
          setReady(true);
        }
      });
    return () => {
      active = false;
      mountedRef.current = false;
    };
  }, []);

  // Each queued write settles before the next starts; its own caller still sees the failure.
  const enqueue = useCallback((operation: () => Promise<void>): Promise<void> => {
    const next = operationQueueRef.current.then(operation);
    operationQueueRef.current = next.then(() => undefined, () => undefined);
    return next;
  }, []);

  const setPreference = useCallback((nextPreference: UiLocalePreference): Promise<void> => {
    if (!isUiLocalePreference(nextPreference)) {
      return Promise.reject(new RangeError(`Unsupported UI locale: ${String(nextPreference)}`));
    }
    if (!mountedRef.current) {
      return Promise.resolve();
    }
    const requestVersion = ++requestVersionRef.current;
    setPreferenceState(nextPreference);
    return enqueue(async () => {
      try {
        await setStoredUiLocalePreference(nextPreference);
        persistedPreferenceRef.current = nextPreference;
      } catch (error) {
        if (mountedRef.current && requestVersionRef.current === requestVersion) {
          setPreferenceState(persistedPreferenceRef.current);
        }
        throw error;
      }
    });
  }, [enqueue]);

  const deleteLocale = useCallback((): Promise<void> => {
    if (!mountedRef.current) {
      return Promise.resolve();
    }
    const requestVersion = ++requestVersionRef.current;
    return enqueue(async () => {
      await deleteStoredUiLocalePreference();
      persistedPreferenceRef.current = "system";
      if (mountedRef.current && requestVersionRef.current === requestVersion) {
        setPreferenceState("system");
      }
    });
  }, [enqueue]);

  const locale = resolveUiLocale(preference, deviceLocales);
  const translator = useMemo(() => createTranslator(locale), [locale]);
  const contextValue = useMemo<UiLocaleContextValue>(() => ({
    deleteLocale,
    direction: directionForLocale(locale),
    locale,
    preference,
    ready,
    setPreference,
    t: translator,
    translate: translator,
  }), [deleteLocale, locale, preference, ready, setPreference, translator]);

  useEffect(() => {
    if (!ready || typeof document === "undefined" || !document.documentElement) {
      return;
    }
    syncDocumentLocale(locale, document.documentElement);
  }, [locale, ready]);

  if (!ready) {
    return null;
  }
  return (
    <UiLocaleContext.Provider value={contextValue}>
      <View style={[providerRoot, uiContentDirectionStyle(locale)]}>{children}</View>
    </UiLocaleContext.Provider>
  );
}

// Renders a subtree in a fixed locale, for previews and store screenshots.
export function UiLocaleOverride({ children, locale }: { children: ReactNode; locale: UiLocale }): ReactNode {
  const parent = useUiLocale();
  const value = useMemo<UiLocaleContextValue>(() => {
    const translator = createTranslator(locale);
    return {
      ...parent,
      direction: directionForLocale(locale),
      locale,
      preference: locale,
      t: translator,
      translate: translator,
    };
  }, [locale, parent]);
  return (
    <UiLocaleContext.Provider value={value}>
      <View style={[providerRoot, uiContentDirectionStyle(locale)]}>{children}</View>
    </UiLocaleContext.Provider>
  );
}

const providerRoot = { flex: 1 } as const;
