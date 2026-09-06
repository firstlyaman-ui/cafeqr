import React, { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useReducedMotion,
  type BaseAnimationBuilder,
  type EntryOrExitLayoutType,
} from "react-native-reanimated";

type Entering = BaseAnimationBuilder | EntryOrExitLayoutType;

/** Soft opacity fade — RareUI-quiet. */
export function softFade(delayMs = 0): Entering {
  return FadeIn.duration(520).delay(delayMs);
}

/** Gentle fade + short rise for staggered cards (starts ~10px below). */
export function softFadeUp(delayMs = 0): Entering {
  return FadeInDown.duration(480)
    .delay(delayMs)
    .withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] });
}

/** Reanimated system flag + AccessibilityInfo / CSS prefers-reduced-motion. */
export function usePrefersReducedMotion() {
  const fromReanimated = useReducedMotion();
  const [fromA11y, setFromA11y] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setFromA11y(!!v);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => {
      setFromA11y(!!v);
    });
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  if (fromReanimated || fromA11y) return true;
  if (Platform.OS === "web" && typeof window !== "undefined") {
    try {
      return !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    } catch {
      return false;
    }
  }
  return false;
}

export function MotionView({
  children,
  entering,
  style,
}: {
  children: React.ReactNode;
  entering?: Entering;
  style?: React.ComponentProps<typeof Animated.View>["style"];
}) {
  const reduce = usePrefersReducedMotion();
  if (reduce || !entering) {
    return <Animated.View style={style}>{children}</Animated.View>;
  }
  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}
