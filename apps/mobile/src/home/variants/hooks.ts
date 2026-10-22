import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated } from "react-native";

import MurmurAudioModule, { type AudioFrameEvent } from "../../../modules/murmur-audio";
import { normalizedMicLevel } from "./logic";

export function useMicLevel(active: boolean): Animated.Value {
  const level = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      Animated.timing(level, { duration: 260, toValue: 0, useNativeDriver: true }).start();
      return;
    }
    const subscription = MurmurAudioModule.addListener("onAudioFrame", (frame: AudioFrameEvent) => {
      Animated.timing(level, {
        duration: 120,
        toValue: normalizedMicLevel(frame.rms),
        useNativeDriver: true,
      }).start();
    });
    return () => subscription.remove();
  }, [active, level]);

  return level;
}

export function useReducedMotion(): boolean | null {
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) {
          setReducedMotion(enabled);
        }
      })
      .catch(() => {
        if (mounted) {
          setReducedMotion(false);
        }
      });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}

export function usePulse(active: boolean, reducedMotion: boolean | null, durationMs = 1400): Animated.Value {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active || reducedMotion) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { duration: durationMs / 2, toValue: 1, useNativeDriver: true }),
        Animated.timing(pulse, { duration: durationMs / 2, toValue: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, durationMs, pulse, reducedMotion]);

  return pulse;
}
