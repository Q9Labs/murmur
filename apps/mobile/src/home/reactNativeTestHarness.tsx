import { createElement, type ReactNode } from "react";

const controls: Array<{ onPress?: () => void }> = [];

function Pressable({ children, onPress }: { children?: ReactNode; onPress?: () => void }): ReactNode {
  controls.push({ onPress });
  return createElement("button", null, children);
}

function Text({ children }: { children?: ReactNode }): ReactNode {
  return createElement("span", null, children);
}

function View({ children }: { children?: ReactNode }): ReactNode {
  return createElement("div", null, children);
}

const reactNativeTestHarness = { Pressable, Text, View, controls };

export default reactNativeTestHarness;
