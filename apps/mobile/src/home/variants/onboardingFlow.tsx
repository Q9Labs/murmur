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

import { uiTextDirectionStyle, useUiLocale } from "../../i18n/runtime";
import type { MessageKey } from "../../i18n/catalogs/en";
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
  const { direction } = useUiLocale();
  const textDirection = uiTextDirectionStyle(direction);
  return (
    <>
      <View style={theme.hero}>{artwork}</View>
      <View style={theme.welcomeBody}>
        <Text accessibilityRole="header" style={[theme.title, textDirection]}>{text.welcomeTitle}</Text>
        <Text style={[theme.copy, textDirection]}>{text.welcomeCopy}</Text>
      </View>
      <View style={theme.footer}>
        <FlowButton disabled={false} label={text.continueLabel} onPress={onContinue} theme={theme} />
      </View>
    </>
  );
}

const privacyPolicyUrl = "https://murmur.q9labs.ai/privacy";

const privacyPoints: ReadonlyArray<{ icon: ComponentType<{ color?: string; size?: number }>; text: MessageKey }> = [
  { icon: AudioLines, text: "onboarding.privacySentToAi" },
  { icon: ShieldCheck, text: "onboarding.privacyNotKept" },
  { icon: ChartNoAxesColumn, text: "onboarding.privacyAnalytics" },
];

function PrivacyStep({
  onPrivacyAgree,
  onTogglePrivacyConsent,
  privacyConsentChecked,
  text,
  theme,
}: FlowProps): ReactNode {
  const { direction, t } = useUiLocale();
  const textDirection = uiTextDirectionStyle(direction);
  return (
    <>
      <View style={theme.body}>
        <Text accessibilityRole="header" style={[theme.title, textDirection]}>{text.privacyTitle}</Text>
        {privacyPoints.map((point) => {
          const Icon = point.icon;
          return (
            <View key={point.text} style={theme.point}>
              <View accessibilityElementsHidden importantForAccessibility="no" style={theme.pointIcon}>
                <Icon color={theme.iconColor} size={20} />
              </View>
              <Text style={[theme.pointText, textDirection]}>{t(point.text)}</Text>
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
          <Text style={[theme.link, textDirection]}>{t("onboarding.privacyPolicy")}</Text>
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
  const { direction, t } = useUiLocale();
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
      <Text style={[theme.pointText, uiTextDirectionStyle(direction), consentFlex]}>
        {t("onboarding.consent")}
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
  const { direction, t } = useUiLocale();
  return (
    <>
      <View style={theme.body}>
        <Text accessibilityRole="header" style={[theme.title, uiTextDirectionStyle(direction)]}>
          {text.languagesTitle}
        </Text>
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
            label={t("onboarding.listenFrom")}
            onPress={() => onCaptureSourceChange(
              captureSource === "microphone" ? "device_playback" : "microphone"
            )}
            theme={theme}
            value={captureSource === "microphone" ? t("capture.microphone") : t("capture.phoneAudio")}
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
