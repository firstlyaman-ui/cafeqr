import { Link } from "expo-router";
import { openExternal } from "@/lib/appRole";
import React from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { borderWidth, colors, radius, shadow, type } from "@/lib/theme";

export function Screen({
  children,
  scroll = true,
  maxWidth = 1080,
  pad = true,
  bg = colors.bg,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  maxWidth?: number;
  pad?: boolean;
  bg?: string;
}) {
  const inner = (
    <View style={[styles.wrap, { maxWidth }, pad && styles.pad]}>{children}</View>
  );
  if (!scroll) {
    return <View style={[styles.page, { backgroundColor: bg }]}>{inner}</View>;
  }
  return (
    <ScrollView
      style={[styles.page, { backgroundColor: bg }]}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 64 }}
      keyboardShouldPersistTaps="handled"
    >
      {inner}
    </ScrollView>
  );
}

export function BrandMark({ accent = colors.gold, light = false }: { accent?: string; light?: boolean }) {
  return (
    <View style={styles.brandRow}>
      <View style={[styles.brandSq, { backgroundColor: light ? colors.white : colors.ink }]}>
        <View style={[styles.brandDot, { backgroundColor: accent }]} />
      </View>
      <Text style={[styles.brandName, light && { color: colors.white }]}>CafeQR</Text>
    </View>
  );
}

export function Kicker({ children, color = colors.muted }: { children: React.ReactNode; color?: string }) {
  return <Text style={[type.kicker, { color }]}>{children}</Text>;
}

function usePressScale(enabled: boolean) {
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const setPressed = (pressed: boolean) => {
    if (!enabled || reduce) return;
    scale.value = withTiming(pressed ? 0.97 : 1, { duration: pressed ? 90 : 140 });
  };
  return { animatedStyle, setPressed, active: enabled && !reduce };
}

export function Btn({
  label,
  onPress,
  href,
  variant = "dark",
  accent,
  disabled,
  style,
  right,
  pressScale = false,
}: {
  label: string;
  onPress?: () => void;
  href?: string;
  variant?: "dark" | "gold" | "gray" | "outline" | "ghost";
  accent?: string;
  disabled?: boolean;
  style?: ViewStyle;
  right?: React.ReactNode;
  /** Gentle scale on press (opt-in; landing CTAs). Staff/owner keep default opacity. */
  pressScale?: boolean;
}) {
  const gold = accent || colors.gold;
  const map = {
    dark: { bg: colors.dark, fg: colors.white, bd: colors.ink },
    gold: { bg: gold, fg: colors.ink, bd: colors.ink },
    gray: { bg: colors.grayBtn, fg: gold, bd: colors.ink },
    outline: { bg: colors.white, fg: colors.ink, bd: colors.ink },
    ghost: { bg: "transparent", fg: colors.muted, bd: "transparent" },
  }[variant];
  const { animatedStyle, setPressed, active } = usePressScale(!!pressScale);
  const body = (
    <Animated.View
      style={[
        styles.btn,
        { backgroundColor: map.bg, borderColor: map.bd, opacity: disabled ? 0.45 : 1 },
        style,
        active ? animatedStyle : null,
      ]}
    >
      <Text style={[styles.btnText, { color: map.fg }]}>{label}</Text>
      {right}
    </Animated.View>
  );
  const pressStyle = ({ pressed }: { pressed: boolean }) => {
    if (active) return undefined;
    return pressed ? { opacity: 0.8 } : undefined;
  };
  const pressHandlers = active
    ? { onPressIn: () => setPressed(true), onPressOut: () => setPressed(false) }
    : {};
  if (href && !disabled) {
    if (/^https?:\/\//i.test(href)) {
      return (
        <Pressable
          onPress={() => openExternal(href)}
          accessibilityRole="link"
          accessibilityLabel={label}
          style={pressStyle}
          {...pressHandlers}
        >
          {body}
        </Pressable>
      );
    }
    return (
      <Link href={href as any} asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={label}
          style={pressStyle}
          {...pressHandlers}
        >
          {body}
        </Pressable>
      </Link>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={pressStyle}
      {...pressHandlers}
    >
      {body}
    </Pressable>
  );
}

export function Field({
  label,
  style,
  ...rest
}: { label?: string } & TextInputProps) {
  return (
    <View style={{ gap: 6, flex: style && (style as any).flex ? 1 : undefined }}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.faint}
        style={[styles.input, style]}
        accessibilityLabel={label || rest.placeholder}
        {...rest}
      />
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={[styles.chip, active && { backgroundColor: colors.ink, borderColor: colors.ink }]}
    >
      <Text style={[styles.chipText, active && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

export function Tag({
  label,
  gold,
  dark,
  accent,
}: {
  label: string;
  gold?: boolean;
  dark?: boolean;
  accent?: string;
}) {
  const bg = gold ? accent || colors.gold : dark ? colors.ink : colors.white;
  const fg = gold || !dark ? colors.ink : colors.white;
  return (
    <View
      style={[
        styles.tag,
        { backgroundColor: bg, borderColor: colors.ink },
      ]}
    >
      <Text style={[styles.tagText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.ink} />
      <Text style={{ color: colors.muted, marginTop: 12, letterSpacing: 2, textTransform: "uppercase", fontSize: 11 }}>
        Loading…
      </Text>
    </View>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Text style={[type.section, { color: colors.ink }]}>{title}</Text>
      <Text style={[type.body, { color: colors.muted, textAlign: "center", marginTop: 8 }]}>{body}</Text>
    </View>
  );
}

export function useCols(min = 280) {
  const { width } = useWindowDimensions();
  const inner = Math.min(width - 32, 1080);
  return inner < 560 ? 1 : inner < 900 ? 2 : 3;
}

export function Hairline() {
  return <View style={styles.hair} />;
}

export function Photo({
  uri,
  height = 160,
  children,
}: {
  uri: string;
  height?: number;
  children?: React.ReactNode;
}) {
  return (
    <View style={[styles.photo, { height }]}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      {children}
    </View>
  );
}

export function Stepper({
  qty,
  onDec,
  onInc,
}: {
  qty: number;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={onDec} accessibilityRole="button" accessibilityLabel="Decrease" style={styles.stepBtn}>
        <Text style={styles.stepGlyph}>−</Text>
      </Pressable>
      <View style={styles.stepMid}>
        <Text style={styles.stepQty}>{qty}</Text>
      </View>
      <Pressable
        onPress={onInc}
        accessibilityRole="button"
        accessibilityLabel="Increase"
        style={[styles.stepBtn, styles.stepPlus]}
      >
        <Text style={styles.stepGlyph}>+</Text>
      </Pressable>
    </View>
  );
}

export function AddBtn({ onPress, label = "+ ADD" }: { onPress: () => void; label?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.addBtn}>
      <Text style={styles.addTxt}>{label}</Text>
    </Pressable>
  );
}

export function Toggle({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.toggle, on && { backgroundColor: colors.ink }]}>
      <Text style={[styles.toggleTxt, on && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}


export function Banner({
  kind = "info",
  children,
}: {
  kind?: "info" | "ok" | "err";
  children: React.ReactNode;
}) {
  const bg = kind === "ok" ? "#E8F5EC" : kind === "err" ? "#FCEBEA" : colors.wash;
  const fg = kind === "ok" ? colors.ready : kind === "err" ? colors.danger : colors.ink;
  return (
    <View style={[styles.banner, { backgroundColor: bg, borderColor: fg }]}>
      <Text style={[styles.bannerTxt, { color: fg }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  wrap: { width: "100%", alignSelf: "center" },
  pad: { paddingHorizontal: 20, paddingTop: 20 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandSq: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  brandDot: { width: 10, height: 10 },
  brandName: { fontSize: 16, fontWeight: "800", letterSpacing: 2, color: colors.ink, textTransform: "uppercase" },
  btn: {
    minHeight: 48,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth,
    borderColor: colors.ink,
    borderRadius: radius,
    flexDirection: "row",
    gap: 10,
  },
  btnText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  fieldLabel: {
    fontSize: 11,
    letterSpacing: 1.8,
    fontWeight: "700",
    textTransform: "uppercase",
    color: colors.muted,
  },
  input: {
    borderWidth,
    borderColor: colors.line,
    borderRadius: radius,
    minHeight: 48,
    paddingHorizontal: 12,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderWidth,
    borderColor: colors.line,
    borderRadius: 999,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: colors.ink,
    textTransform: "uppercase",
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth,
    borderColor: colors.line,
    borderRadius: 6,
    backgroundColor: colors.white,
  },
  tagText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.muted,
  },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, backgroundColor: colors.bg },
  empty: { padding: 28, alignItems: "center" },
  hair: { height: 1, backgroundColor: colors.line, width: "100%" },
  banner: { borderWidth, borderRadius: radius, paddingHorizontal: 14, paddingVertical: 12 },
  bannerTxt: { fontSize: 13, fontWeight: "700", lineHeight: 18 },
  photo: { width: "100%", backgroundColor: colors.wash, overflow: "hidden" },
  stepper: { flexDirection: "row", borderWidth, borderColor: colors.line, borderRadius: radius, overflow: "hidden", alignSelf: "flex-start" },
  stepBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  stepPlus: { backgroundColor: colors.gold },
  stepMid: {
    minWidth: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.line,
  },
  stepQty: { color: colors.white, fontWeight: "800", fontSize: 13 },
  stepGlyph: { fontSize: 18, fontWeight: "700", color: colors.ink, marginTop: -1 },
  addBtn: {
    backgroundColor: colors.ink,
    minHeight: 36,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth,
    borderColor: colors.ink,
    borderRadius: radius,
  },
  addTxt: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  toggle: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderWidth,
    borderColor: colors.line,
    borderRadius: 999,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleTxt: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.ink,
  },
});
