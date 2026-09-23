import type { ReactNode } from "react";

import { recorded } from "./reactNativePrimitives";

export function ScreenScaffold(props: { children: ReactNode; footer?: ReactNode; title: string }): ReactNode {
  return (
    <section>
      <h1>{props.title}</h1>
      {props.children}
      {props.footer}
    </section>
  );
}

export function PrimaryAction(props: { disabled?: boolean; label: string; onPress: () => void }): ReactNode {
  recorded.controls.push({
    accessibilityLabel: props.label,
    accessibilityRole: "button",
    disabled: props.disabled,
    onPress: props.onPress,
  });
  return <button>{props.label}</button>;
}

export function StatusLine(props: { error: string | null; notice: string | null }): ReactNode {
  return <p>{props.notice}{props.error}</p>;
}

export const SecondaryAction = PrimaryAction;

export function QuietAction(props: { label: string; onPress: () => void }): ReactNode {
  recorded.controls.push({ accessibilityLabel: props.label, accessibilityRole: "button", onPress: props.onPress });
  return <button>{props.label}</button>;
}
