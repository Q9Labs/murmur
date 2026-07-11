import type { ReactNode } from "react";
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

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
  copyEmphasis?: StyleProp<TextStyle>;
  eyebrow: StyleProp<TextStyle>;
  footer: StyleProp<ViewStyle>;
  pressed: StyleProp<ViewStyle>;
  privacyEyebrow?: StyleProp<TextStyle>;
  setupRow: StyleProp<ViewStyle>;
  setupValue: StyleProp<TextStyle>;
  title: StyleProp<TextStyle>;
};

export type OnboardingText = {
  agreeLabel: string;
  continueLabel: string;
  languagesEyebrowText: string;
  languagesTitle: string;
  listenLabel: string;
  privacyEyebrowText: string;
  privacyTitle?: string;
  sourceLabel: string;
  targetLabel: string;
  welcomeCopy: string;
  welcomeEyebrowText?: string;
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

function WelcomeStep({ artwork, onContinue, text, theme }: FlowProps): ReactNode {
  return (
    <>
      <View style={theme.body}>
        {artwork}
        {text.welcomeEyebrowText ? <Text style={theme.eyebrow}>{text.welcomeEyebrowText}</Text> : null}
        <Text style={theme.title}>{text.welcomeTitle}</Text>
        <Text style={theme.copy}>{text.welcomeCopy}</Text>
      </View>
      <View style={theme.footer}>
        <FlowButton disabled={false} label={text.continueLabel} onPress={onContinue} theme={theme} />
      </View>
    </>
  );
}

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
        <Text style={theme.privacyEyebrow ?? theme.eyebrow}>{text.privacyEyebrowText}</Text>
        {text.privacyTitle ? <Text style={theme.title}>{text.privacyTitle}</Text> : null}
        <Text style={theme.copyEmphasis ?? theme.copy}>
          When you tap Listen, Murmur sends live audio to Deepgram, captions to OpenRouter
          through Q9 Labs on Cloudflare, and translated text to Cartesia for speech.
        </Text>
        <Text style={theme.copy}>
          Murmur uses this data only to provide translation, speech output, safety reports,
          diagnostics, and abuse prevention.
        </Text>
        <Text style={theme.copy}>Murmur does not save audio or transcript history by default.</Text>
        <ConsentRow checked={privacyConsentChecked} onToggle={onTogglePrivacyConsent} theme={theme} />
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
      <Text style={[theme.copy, consentFlex]}>
        I agree to share this data with these services for live AI translation.
      </Text>
    </Pressable>
  );
}

function LanguagesStep({
  canStart,
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
        <Text style={theme.eyebrow}>{text.languagesEyebrowText}</Text>
        <Text style={theme.title}>{text.languagesTitle}</Text>
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
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [theme.setupRow, pressed && theme.pressed]}
    >
      <Text style={theme.eyebrow}>{label}</Text>
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
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [theme.buttonStyle, (pressed || disabled) && theme.pressed]}
    >
      <Text style={theme.buttonTextStyle}>{label}</Text>
    </Pressable>
  );
}
