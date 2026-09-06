import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Btn, Empty, Screen } from "@/components/ui";
import { cartTotals, lineUnitPrice, money, optionBlurb, tableLabel, taxLabel } from "@/lib/format";
import { useStore } from "@/lib/store";
import { colors, type } from "@/lib/theme";

export default function Cart() {
  const { cart, items, cafe, cartTable, setQty, removeLine } = useStore();
  const totals = cartTotals(cart, items, cafe);
  const cur = cafe.currency || "USD";
  const table = cartTable || "04";

  return (
    <Screen>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backT}>← Menu</Text>
      </Pressable>
      <Text style={[type.kicker, { color: colors.muted }]}>{tableLabel(table)} · {cafe.name}</Text>
      <Text style={[type.title, { marginTop: 8 }]}>Your tray</Text>

      {cart.length === 0 ? (
        <Empty title="Tray is empty" body="Add something from the menu — coffee first is never wrong." />
      ) : (
        <View style={{ marginTop: 20, gap: 12 }}>
          {cart.map((line) => {
            const item = items.find((i) => i.id === line.itemId);
            if (!item) return null;
            const unit = lineUnitPrice(item, { milk: line.milk, extraShot: line.extraShot, selections: line.selections }, undefined, cafe);
            return (
              <View key={line.lineId} style={styles.row}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  {optionBlurb({ milk: line.milk, extraShot: line.extraShot, selections: line.selections, item }, undefined, cafe) ? (
                    <Text style={styles.opt}>{optionBlurb({ milk: line.milk, extraShot: line.extraShot, selections: line.selections, item }, undefined, cafe)}</Text>
                  ) : null}
                  <Text style={styles.price}>{money(unit, cur)} each</Text>
                </View>
                <View style={styles.qty}>
                  <Pressable onPress={() => setQty(line.lineId, line.qty - 1)} style={styles.qbtn} accessibilityLabel="Decrease quantity">
                    <Text style={styles.qT}>−</Text>
                  </Pressable>
                  <Text style={styles.qN}>{line.qty}</Text>
                  <Pressable onPress={() => setQty(line.lineId, line.qty + 1)} style={styles.qbtn} accessibilityLabel="Increase quantity">
                    <Text style={styles.qT}>+</Text>
                  </Pressable>
                </View>
                <Pressable onPress={() => removeLine(line.lineId)} style={styles.rm} accessibilityLabel={`Remove ${item.name}`}>
                  <Text style={styles.rmT}>Remove</Text>
                </Pressable>
              </View>
            );
          })}

          <View style={styles.sums}>
            <Line k="Subtotal" v={money(totals.subtotal, cur)} />
            {totals.tax > 0 ? <Line k={taxLabel(totals.taxName, totals.taxRate)} v={money(totals.tax, cur)} /> : null}
            <Line k="Total" v={money(totals.total, cur)} bold />
          </View>
          {cafe.cashOnly ? (
            <Text style={styles.cash}>Cash at the counter — no card on this table.</Text>
          ) : null}
          <Btn label="Checkout" onPress={() => router.push("/checkout")} />
        </View>
      )}
    </Screen>
  );
}

function Line({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <View style={styles.sumRow}>
      <Text style={[styles.sumK, bold && { color: colors.ink, fontWeight: "800" }]}>{k}</Text>
      <Text style={[styles.sumV, bold && { fontSize: 20 }]}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { minHeight: 44, justifyContent: "center", marginBottom: 8 },
  backT: { fontSize: 13, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: colors.ink },
  row: { borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 12, gap: 8 },
  name: { fontSize: 16, fontWeight: "700", color: colors.ink },
  opt: { marginTop: 4, fontSize: 13, color: colors.muted },
  price: { marginTop: 4, fontSize: 13, color: colors.ink },
  qty: { flexDirection: "row", alignItems: "center", gap: 8 },
  qbtn: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  qT: { fontSize: 20, fontWeight: "600", color: colors.ink },
  qN: { minWidth: 20, textAlign: "center", fontWeight: "700", fontSize: 16 },
  rm: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  rmT: { fontSize: 12, color: colors.danger, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
  sums: { marginTop: 8, paddingTop: 8, gap: 8 },
  sumRow: { flexDirection: "row", justifyContent: "space-between" },
  sumK: { color: colors.muted, fontSize: 15 },
  sumV: { fontWeight: "700", fontSize: 15, color: colors.ink },
  cash: { color: colors.muted, fontSize: 13, marginBottom: 4 },
});
