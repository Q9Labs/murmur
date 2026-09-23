import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { View } from "react-native";

import {
  createTranslator,
  uiContentDirectionStyle,
  UiLocaleContext,
  type UiLocaleContextValue,
} from "./runtime";
import { deleteStoredUiLocale, getStoredUiLocale, setStoredUiLocale } from "./storage";
import { directionForLocale, isUiLocale, type UiLocale } from "./types";

type DocumentLocaleRoot = { dir: string; lang: string };

export function syncDocumentLocale(locale: UiLocale, root: DocumentLocaleRoot): void {
  root.lang = locale;
  root.dir = directionForLocale(locale);
}

export function UiLocaleProvider({ children }: { children: ReactNode }): ReactNode {
  const [locale, setLocaleState] = useState<UiLocale>("en");
  const [ready, setReady] = useState(false);
  const mountedRef = useRef(false);
  const persistedLocaleRef = useRef<UiLocale>("en");
  const requestVersionRef = useRef(0);
  const operationQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    mountedRef.current = true;
    let active = true;
    void getStoredUiLocale().then((storedLocale) => {
      if (!active) {
        return;
      }
      persistedLocaleRef.current = storedLocale;
      setLocaleState(storedLocale);
      setReady(true);
    });
    return () => {
      active = false;
      mountedRef.current = false;
    };
  }, []);

  const enqueue = useCallback((operation: () => Promise<void>): Promise<void> => {
    const next = operationQueueRef.current.catch(() => undefined).then(operation);
    operationQueueRef.current = next.catch(() => undefined);
    return next;
  }, []);

  const setLocale = useCallback((nextLocale: UiLocale): Promise<void> => {
    if (!isUiLocale(nextLocale)) {
      return Promise.reject(new RangeError(`Unsupported UI locale: ${String(nextLocale)}`));
    }
    if (!mountedRef.current) {
      return Promise.resolve();
    }
    const requestVersion = ++requestVersionRef.current;
    setLocaleState(nextLocale);
    return enqueue(async () => {
      try {
        await setStoredUiLocale(nextLocale);
        persistedLocaleRef.current = nextLocale;
      } catch (error) {
        if (mountedRef.current && requestVersionRef.current === requestVersion) {
          setLocaleState(persistedLocaleRef.current);
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
      await deleteStoredUiLocale();
      persistedLocaleRef.current = "en";
      if (mountedRef.current && requestVersionRef.current === requestVersion) {
        setLocaleState("en");
      }
    });
  }, [enqueue]);

  const translator = useMemo(() => createTranslator(locale), [locale]);
  const contextValue = useMemo<UiLocaleContextValue>(() => ({
    deleteLocale,
    direction: directionForLocale(locale),
    locale,
    ready,
    setLocale,
    t: translator,
    translate: translator,
  }), [deleteLocale, locale, ready, setLocale, translator]);

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

const providerRoot = { flex: 1 } as const;
