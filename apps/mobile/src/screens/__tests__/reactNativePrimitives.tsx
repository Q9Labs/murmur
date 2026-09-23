import { createElement, type ReactNode } from "react";

export type RecordedControl = {
  accessibilityHint?: string;
  accessibilityLabel?: string;
  accessibilityRole?: string;
  accessibilityState?: { busy?: boolean; checked?: boolean; disabled?: boolean; selected?: boolean };
  disabled?: boolean;
  onPress?: () => void;
};

export type RecordedInput = {
  accessibilityLabel?: string;
  editable?: boolean;
  onChangeText?: (text: string) => void;
  onSubmitEditing?: () => void;
  value?: string;
};

export type RecordedSwitch = {
  accessibilityLabel?: string;
  disabled?: boolean;
  onValueChange?: (value: boolean) => void;
  value?: boolean;
};

export type RecordedAlert = {
  buttons: Array<{ onPress?: () => void; style?: string; text: string }>;
  message: string;
  title: string;
};

export const recorded = {
  alerts: [] as RecordedAlert[],
  controls: [] as RecordedControl[],
  inputs: [] as RecordedInput[],
  roles: [] as string[],
  switches: [] as RecordedSwitch[],
};

export function resetRecorded(): void {
  recorded.alerts.length = 0;
  recorded.controls.length = 0;
  recorded.inputs.length = 0;
  recorded.roles.length = 0;
  recorded.switches.length = 0;
}

export function findControl(label: string): RecordedControl | undefined {
  return recorded.controls.find(
    (control) => control.accessibilityLabel === label || control.accessibilityHint === label,
  );
}

function Pressable(props: RecordedControl & { children?: ReactNode; style?: unknown }): ReactNode {
  recorded.controls.push(props);
  if (typeof props.style === "function") {
    props.style({ pressed: false });
  }
  return createElement("button", null, props.children);
}

function Text({ children }: { children?: ReactNode }): ReactNode {
  return createElement("span", null, children);
}

function View(props: { accessibilityRole?: string; children?: ReactNode }): ReactNode {
  if (props.accessibilityRole) {
    recorded.roles.push(props.accessibilityRole);
  }
  return createElement("div", null, props.children);
}

function TextInput(props: RecordedInput & { placeholder?: string }): ReactNode {
  recorded.inputs.push(props);
  return createElement("input", { placeholder: props.placeholder, readOnly: true, value: props.value });
}

function Switch(props: RecordedSwitch): ReactNode {
  recorded.switches.push(props);
  return createElement("input", { checked: props.value, readOnly: true, type: "checkbox" });
}

function ScrollView({ children }: { children?: ReactNode }): ReactNode {
  return createElement("main", null, children);
}

export const reactNativePrimitives = {
  Alert: {
    alert: (title: string, message: string, buttons: RecordedAlert["buttons"]) => {
      recorded.alerts.push({ buttons, message, title });
    },
  },
  Image: () => null,
  Platform: { OS: "ios" as "android" | "ios" },
  Pressable,
  ScrollView,
  StatusBar: () => null,
  StyleSheet: { create: <T,>(styles: T): T => styles },
  Switch,
  Text,
  TextInput,
  useColorScheme: () => "light",
  View,
};
