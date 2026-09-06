import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { money, waitCopy } from "@/lib/format";
import { borderWidth, colors, radius, shadow } from "@/lib/theme";

export function CartBar({
  count,
  total,
  wait,
  cash,
  onBag,
  onCheckout,
  currency = "USD",
  disabled,
  disabledLabel,
}: {
  count: number;
  total: number;
  wait: number;
  cash: boolean;
  onBag: () => void;
  onCheckout: () => void;
  currency?: string;
  disabled?: boolean;
  disabledLabel?: string;
}) {
  if (count <= 0) return null;
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.bar}>
        <Pressable onPress={onBag} style={styles.count} accessibilityLabel="View bag">
          <Text style={styles.countTxt}>{count}</Text>
        </Pressable>
        <Pressable onPress={onBag} style={{ flex: 1 }} accessibilityLabel="View bag details">
          <View style={styles.row}>
            <Text style={styles.total}>{money(total, currency)}</Text>
            {cash ? (
              <View style={styles.cash}>
                <Text style={styles.cashTxt}>CASH</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.wait}>
            {disabled ? disabledLabel || "Ordering closed" : `Est. prep ~${waitCopy(wait)}`}
          </Text>
        </Pressable>
        <Pressable
          onPress={disabled ? undefined : onCheckout}
          style={[styles.out, disabled && styles.outOff]}
          accessibilityLabel={disabled ? disabledLabel || "Checkout unavailable" : "Checkout"}
          disabled={!!disabled}
        >
          <Text style={[styles.outTxt, disabled && styles.outTxtOff]}>
            {disabled ? "CLOSED" : "CHECKOUT ›"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    paddingBottom: 16,
    alignItems: "center",
  },
  bar: {
    width: "100%",
    maxWidth: 560,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.ink,
    borderWidth,
    borderColor: colors.ink,
    borderRadius: radius,
    padding: 8,
    ...shadow.hard,
  },
  count: {
    width: 48,
    height: 48,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    borderWidth,
    borderColor: colors.ink,
  },
  countTxt: { fontSize: 18, fontWeight: "800", color: colors.ink },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  total: { color: colors.white, fontSize: 18, fontWeight: "800" },
  cash: { backgroundColor: colors.gold, paddingHorizontal: 6, paddingVertical: 2 },
  cashTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 1, color: colors.ink },
  wait: { color: colors.gold, fontSize: 11, letterSpacing: 0.6, marginTop: 2, fontWeight: "700" },
  out: {
    minHeight: 48,
    paddingHorizontal: 16,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    borderWidth,
    borderColor: colors.ink,
  },
  outOff: { backgroundColor: colors.grayBtn },
  outTxt: { color: colors.ink, fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  outTxtOff: { color: colors.white },
});
