import * as Linking from "expo-linking";
import { AudioLines, ChartNoAxesColumn, ShieldCheck } from "lucide-react-native";
import type { ComponentType, ReactNode } from "react";
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { captureMobileFailure } from "../../lib/observability/sentry";
import type { VariantOnboardingProps } from "./types";

export type OnboardingTheme = {
  body: StyleProp<ViewStyle>;
  buttonStyle: StyleProp<ViewStyle>;
  buttonTextStyle: StyleProp<TextStyle>;
  checkbox: StyleProp<ViewStyle>;
  checkboxChecked: StyleProp<ViewStyle>;
  checkboxMark: StyleProp<TextStyle>;
  consentRow: StyleProp<ViewStyle>;
  copy: StyleProp<TextStyle>;
  footer: StyleProp<ViewStyle>;
  hero: StyleProp<ViewStyle>;
  iconColor: string;
  link: StyleProp<TextStyle>;
  point: StyleProp<ViewStyle>;
  pointIcon: StyleProp<ViewStyle>;
  pointText: StyleProp<TextStyle>;
  pressed: StyleProp<ViewStyle>;
  setupLabel: StyleProp<TextStyle>;
  setupRow: StyleProp<ViewStyle>;
  setupValue: StyleProp<TextStyle>;
  title: StyleProp<TextStyle>;
  welcomeBody: StyleProp<ViewStyle>;
};

export type OnboardingText = {
  agreeLabel: string;
  continueLabel: string;
  languagesTitle: string;
  listenLabel: string;
  privacyTitle: string;
  sourceLabel: string;
  targetLabel: string;
  welcomeCopy: string;
  welcomeTitle: string;
};

type FlowProps = VariantOnboardingProps & {
  artwork?: ReactNode;
  text: OnboardingText;
  theme: OnboardingTheme;
};

export function OnboardingFlow(props: FlowProps): ReactNode {
  if (props.step === "welcome") {
    return <WelcomeStep {...props} />;
  }
  if (props.step === "privacy") {
    return <PrivacyStep {...props} />;
  }
  return <LanguagesStep {...props} />;
}

// The artwork fills the space above the words, so there is no empty band under the header.
function WelcomeStep({ artwork, onContinue, text, theme }: FlowProps): ReactNode {
  return (
    <>
      <View style={theme.hero}>{artwork}</View>
      <View style={theme.welcomeBody}>
        <Text accessibilityRole="header" style={theme.title}>{text.welcomeTitle}</Text>
        <Text style={theme.copy}>{text.welcomeCopy}</Text>
      </View>
      <View style={theme.footer}>
        <FlowButton disabled={false} label={text.continueLabel} onPress={onContinue} theme={theme} />
      </View>
    </>
  );
}

const privacyPolicyUrl = "https://murmur.q9labs.ai/privacy";

const privacyPoints: ReadonlyArray<{ icon: ComponentType<{ color?: string; size?: number }>; text: string }> = [
  { icon: AudioLines, text: "What you listen to is sent to a third-party AI service and translated live." },
  { icon: ShieldCheck, text: "Murmur doesn't keep your audio or translations on its servers." },
  { icon: ChartNoAxesColumn, text: "Anonymous analytics help us improve Murmur. You can turn them off in Settings." },
];

function PrivacyStep({
  onPrivacyAgree,
  onTogglePrivacyConsent,
  privacyConsentChecked,
  text,
  theme,
}: FlowProps): ReactNode {
  return (
    <>
      <View style={theme.body}>
        <Text accessibilityRole="header" style={theme.title}>{text.privacyTitle}</Text>
        {privacyPoints.map((point) => {
          const Icon = point.icon;
          return (
            <View key={point.text} style={theme.point}>
              <View accessibilityElementsHidden importantForAccessibility="no" style={theme.pointIcon}>
                <Icon color={theme.iconColor} size={20} />
              </View>
              <Text style={theme.pointText}>{point.text}</Text>
            </View>
          );
        })}
        <ConsentRow checked={privacyConsentChecked} onToggle={onTogglePrivacyConsent} theme={theme} />
        <Pressable
          accessibilityRole="link"
          hitSlop={10}
          onPress={() => {
            Linking.openURL(privacyPolicyUrl).catch((failure: unknown) => {
              captureMobileFailure(failure, { operation: "open_privacy_policy", stage: "onboarding" });
            });
          }}
          style={({ pressed }) => [pressed && theme.pressed]}
        >
          <Text style={theme.link}>Privacy policy</Text>
        </Pressable>
      </View>
      <View style={theme.footer}>
        <FlowButton
          disabled={!privacyConsentChecked}
          label={text.agreeLabel}
          onPress={onPrivacyAgree}
          theme={theme}
        />
      </View>
    </>
  );
}

const consentFlex = { flex: 1 } as const;

function ConsentRow({
  checked,
  onToggle,
  theme,
}: {
  checked: boolean;
  onToggle: () => void;
  theme: OnboardingTheme;
}): ReactNode {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={theme.consentRow}
    >
      <View style={[theme.checkbox, checked && theme.checkboxChecked]}>
        <Text style={theme.checkboxMark}>{checked ? "✓" : ""}</Text>
      </View>
      <Text style={[theme.pointText, consentFlex]}>
        I agree to send audio to a third-party AI service for translation.
      </Text>
    </Pressable>
  );
}

function LanguagesStep({
  canStart,
  captureSource,
  devicePlaybackSupported,
  onCaptureSourceChange,
  onOpenPicker,
  onStart,
  sourceLanguage,
  targetLanguage,
  text,
  theme,
}: FlowProps): ReactNode {
  return (
    <>
      <View style={theme.body}>
        <Text accessibilityRole="header" style={theme.title}>{text.languagesTitle}</Text>
        <SetupRow
          label={text.sourceLabel}
          onPress={() => onOpenPicker("source")}
          theme={theme}
          value={sourceLanguage}
        />
        <SetupRow
          label={text.targetLabel}
          onPress={() => onOpenPicker("target")}
          theme={theme}
          value={targetLanguage}
        />
        {devicePlaybackSupported ? (
          <SetupRow
            label="Listen from"
            onPress={() => onCaptureSourceChange(
              captureSource === "microphone" ? "device_playback" : "microphone"
            )}
            theme={theme}
            value={captureSource === "microphone" ? "Microphone" : "Phone audio"}
          />
        ) : null}
      </View>
      <View style={theme.footer}>
        <FlowButton disabled={!canStart} label={text.listenLabel} onPress={onStart} theme={theme} />
      </View>
    </>
  );
}

function SetupRow({
  label,
  onPress,
  theme,
  value,
}: {
  label: string;
  onPress: () => void;
  theme: OnboardingTheme;
  value: string;
}): ReactNode {
  return (
    <Pressable
      accessibilityLabel={`${label}, ${value}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [theme.setupRow, pressed && theme.pressed]}
    >
      <Text style={theme.setupLabel}>{label}</Text>
      <Text style={theme.setupValue}>{value}</Text>
    </Pressable>
  );
}

function FlowButton({
  disabled,
  label,
  onPress,
  theme,
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
  theme: OnboardingTheme;
}): ReactNode {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [theme.buttonStyle, (pressed || disabled) && theme.pressed]}
    >
      <Text style={theme.buttonTextStyle}>{label}</Text>
    </Pressable>
  );
}
