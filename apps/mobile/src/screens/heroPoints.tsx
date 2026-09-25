import type { ComponentType, ReactNode } from "react";
import { Text, View } from "react-native";

import { useScreenStyles } from "./styles";

export type HeroPoint = {
  icon: ComponentType<{ color?: string; size?: number }>;
  text: string;
};

// The short list of what a hero screen offers or promises, each point led by an icon in a neutral circle.
export function HeroPoints({ points }: { points: readonly HeroPoint[] }): ReactNode {
  const { colors, styles } = useScreenStyles();
  return (
    <View style={styles.points}>
      {points.map((point) => {
        const Icon = point.icon;
        return (
          <View key={point.text} style={styles.point}>
            <View accessibilityElementsHidden importantForAccessibility="no" style={styles.pointIcon}>
              <Icon color={colors.primary} size={20} />
            </View>
            <Text style={styles.pointText}>{point.text}</Text>
          </View>
        );
      })}
    </View>
  );
}
