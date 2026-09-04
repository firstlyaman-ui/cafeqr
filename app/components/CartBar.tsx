import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { money, waitCopy } from "@/lib/format";
import { colors } from "@/lib/theme";

export function CartBar({
  count,
  total,
  wait,
  cash,
  onBag,
  onCheckout,
  currency = "USD",
}: {
  count: number;
  total: number;
  wait: number;
  cash: boolean;
  onBag: () => void;
  onCheckout: () => void;
  currency?: string;
}) {
  if (count <= 0) return null;
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.bar}>
        <View style={styles.count}>
          <Text style={styles.countTxt}>{count}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.row}>
            <Text style={styles.total}>{money(total, currency)}</Text>
            {cash ? (
              <View style={styles.cash}>
                <Text style={styles.cashTxt}>CASH</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.wait}>Est. Prep: ~{waitCopy(wait)}</Text>
        </View>
        <Pressable onPress={onBag} style={styles.view} accessibilityLabel="View bag">
          <Text style={styles.viewTxt}>VIEW BAG</Text>
        </Pressable>
        <Pressable onPress={onCheckout} style={styles.out} accessibilityLabel="Checkout">
          <Text style={styles.outTxt}>CHECKOUT ›</Text>
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
    alignItems: "center",
  },
  bar: {
    width: "100%",
    maxWidth: 720,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.ink,
    borderWidth: 1.5,
    borderColor: colors.ink,
    padding: 8,
    paddingRight: 8,
  },
  count: {
    width: 44,
    height: 44,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  countTxt: { fontSize: 18, fontWeight: "800", color: colors.ink },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  total: { color: colors.white, fontSize: 18, fontWeight: "800" },
  cash: { backgroundColor: colors.gold, paddingHorizontal: 6, paddingVertical: 2 },
  cashTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 1, color: colors.ink },
  wait: { color: colors.gold, fontSize: 11, letterSpacing: 0.6, marginTop: 2, fontWeight: "700" },
  view: {
    minHeight: 44,
    paddingHorizontal: 12,
    backgroundColor: colors.grayBtn,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  viewTxt: { color: colors.white, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  out: {
    minHeight: 44,
    paddingHorizontal: 12,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  outTxt: { color: colors.ink, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
});
