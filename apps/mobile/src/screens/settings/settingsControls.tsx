import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

// The home screen owns the live session, analytics preference and local data, so it
// publishes the controls the Settings route needs through this typed bridge.
export type SettingsControls = {
  analyticsEnabled: boolean;
  changeAnalytics: (enabled: boolean) => void;
  changeInsightsConsent: (enabled: boolean) => void;
  deleteLocalData: () => void;
  locked: boolean;
  insightsConsent: boolean | null;
  message: string | null;
  openReport: () => void;
  reportLabel: string;
  resetIdentity: () => void;
  share: () => void;
};

type SettingsControlsBridge = {
  controls: SettingsControls | null;
  publish: (controls: SettingsControls | null) => void;
};

const SettingsControlsContext = createContext<SettingsControlsBridge>({
  controls: null,
  publish: () => undefined,
});

export function SettingsControlsProvider({ children }: { children: ReactNode }): ReactNode {
  const [controls, publish] = useState<SettingsControls | null>(null);
  const bridge = useMemo(() => ({ controls, publish }), [controls]);
  return <SettingsControlsContext.Provider value={bridge}>{children}</SettingsControlsContext.Provider>;
}

export function SettingsControlsFixture(props: {
  children: ReactNode;
  controls: SettingsControls;
}): ReactNode {
  const bridge = useMemo(() => ({ controls: props.controls, publish: () => undefined }), [props.controls]);
  return <SettingsControlsContext.Provider value={bridge}>{props.children}</SettingsControlsContext.Provider>;
}

export function usePublishSettingsControls(controls: SettingsControls): void {
  const { publish } = useContext(SettingsControlsContext);
  useEffect(() => {
    publish(controls);
  }, [controls, publish]);
  useEffect(() => () => publish(null), [publish]);
}

export function useSettingsControls(): SettingsControls | null {
  return useContext(SettingsControlsContext).controls;
}
