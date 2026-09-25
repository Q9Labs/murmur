import type { ReactNode } from "react";

import { recorded } from "./reactNativePrimitives";

export function ScreenScaffold(props: { children?: ReactNode; footer?: ReactNode; lead?: string; title: string }): ReactNode {
  return (
    <section>
      <h1>{props.title}</h1>
      {props.lead ? <p>{props.lead}</p> : null}
      {props.children}
      {props.footer}
    </section>
  );
}

type ActionProps = { disabled?: boolean; label: string; onPress: () => void };

// Each action renders its tone so tests can check which answer a screen emphasizes.
function recordAction(tone: "primary" | "quiet" | "secondary", props: ActionProps): ReactNode {
  recorded.controls.push({
    accessibilityLabel: props.label,
    accessibilityRole: "button",
    disabled: props.disabled,
    onPress: props.onPress,
  });
  return <button data-action={tone}>{props.label}</button>;
}

export function PrimaryAction(props: ActionProps): ReactNode {
  return recordAction("primary", props);
}

export function SecondaryAction(props: ActionProps): ReactNode {
  return recordAction("secondary", props);
}

export function QuietAction(props: ActionProps): ReactNode {
  return recordAction("quiet", props);
}

export function StatusLine(props: { error: string | null; notice: string | null }): ReactNode {
  return <p>{props.notice}{props.error}</p>;
}
