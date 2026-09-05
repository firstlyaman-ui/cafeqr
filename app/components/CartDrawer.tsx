import { router } from "expo-router";
import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { Stepper } from "@/components/ui";
import { cartTotals, lineUnitPrice, money, optionBlurb, waitCopy } from "@/lib/format";
import { useStore } from "@/lib/store";
import { hapticLight } from "@/lib/haptics";
import { borderWidth, colors, radius } from "@/lib/theme";
import { TAX_RATE } from "@/lib/types";

export function CartDrawer({ open, onClose, table }: { open: boolean; onClose: () => void; table?: string }) {
  const { cart, items, cafe, cartTable, setQty } = useStore();
  const cur = cafe.currency || "USD";
  const { width } = useWindowDimensions();
  const drawerW = Math.min(420, width);
  const totals = cartTotals(cart, items, cafe.currency || "USD");
  const accent = cafe.accentColor || colors.gold;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.bak}>
        <Pressable style={styles.dim} onPress={onClose} accessibilityLabel="Close bag" />
        <View style={[styles.drawer, { width: drawerW }]}>
          <View style={styles.head}>
            <View style={[styles.bagIcon, { backgroundColor: accent }]}>
              <Text style={{ fontSize: 16 }}>👜</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headTitle}>YOUR ORDER BAG</Text>
              <Text style={[styles.headSub, { color: accent }]}>
                {totals.count} ITEM{totals.count === 1 ? "" : "S"} SELECTED
              </Text>
            </View>
            <Pressable onPress={onClose} accessibilityLabel="Close" style={styles.x}>
              <Text style={{ color: colors.white, fontWeight: "800" }}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.prepBar}>
            <Text style={styles.prepLbl}>EST. ORDER PREP TIME</Text>
            <View style={[styles.prepBadge, { backgroundColor: accent }]}>
              <Text style={styles.prepBadgeTxt}>~{waitCopy(totals.wait).toUpperCase()}</Text>
            </View>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, gap: 10 }}>
            {cart.map((line) => {
              const item = items.find((i) => i.id === line.itemId);
              if (!item) return null;
              const blurb = optionBlurb(line.milk, line.extraShot);
              return (
                <View key={line.lineId} style={styles.line}>
                  <View style={styles.lineTop}>
                    <Text style={styles.lineName}>{item.name.toUpperCase()}</Text>
                    <Text style={styles.linePrice}>{money(lineUnitPrice(item, line.milk, line.extraShot) * line.qty, cur)}</Text>
                  </View>
                  <View style={styles.lineMid}>
                    <View style={styles.miniPrep}>
                      <Text style={styles.miniPrepTxt}>PREP: {item.prepMinutes} MINS</Text>
                    </View>
                    {blurb ? <Text style={styles.blurb}>{blurb}</Text> : null}
                  </View>
                  <View style={styles.lineBot}>
                    <Text style={styles.each}>{money(lineUnitPrice(item, line.milk, line.extraShot), cur)} each</Text>
                    <Stepper qty={line.qty} onDec={() => setQty(line.lineId, line.qty - 1)} onInc={() => setQty(line.lineId, line.qty + 1)} />
                  </View>
                </View>
              );
            })}

            {cafe.cashOnly ? (
              <View style={[styles.cashNote, { backgroundColor: colors.goldSoft }]}>
                <Text style={styles.cashNoteTxt}>
                  CASH EXCLUSIVE: HAND EXACT CASH TO COUNTER CASHIER.
                </Text>
              </View>
            ) : null}

            <View style={styles.sum}>
              <View style={styles.sumRow}>
                <Text style={styles.sumLbl}>Subtotal</Text>
                <Text style={styles.sumVal}>{money(totals.subtotal, cur)}</Text>
              </View>
              {cur === "INR" ? null : (
                <View style={styles.sumRow}>
                  <Text style={styles.sumLbl}>Estimated tax ({(TAX_RATE * 100).toFixed(1)}%)</Text>
                  <Text style={styles.sumVal}>{money(totals.tax, cur)}</Text>
                </View>
              )}
              <View style={styles.rule} />
              <View style={styles.sumRow}>
                <Text style={styles.due}>TOTAL DUE {cafe.cashOnly ? "(CASH)" : ""}</Text>
                <Text style={styles.dueAmt}>{money(totals.total, cur)}</Text>
              </View>
            </View>
          </ScrollView>

          <Pressable
            onPress={() => {
              void hapticLight();
              onClose();
              const t = table || cartTable || "04";
              router.push({ pathname: "/checkout", params: { table: t, slug: cafe.slug } } as any);
            }}
            disabled={!cart.length}
            style={[styles.cta, !cart.length && { opacity: 0.4 }]}
            accessibilityLabel="Checkout"
          >
            <Text style={styles.ctaTxt}>CHECKOUT</Text>
            <Text style={[styles.ctaPrice, { color: accent }]}>
              {money(totals.total, cur)}  ›
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bak: { flex: 1, flexDirection: "row", justifyContent: "flex-end" },
  dim: { flex: 1, backgroundColor: colors.overlay },
  drawer: {
    backgroundColor: colors.bg,
    borderLeftWidth: 1,
    borderColor: colors.ink,
    height: "100%",
  },
  head: {
    backgroundColor: colors.ink,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  bagIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headTitle: { color: colors.white, fontSize: 16, fontWeight: "800", letterSpacing: 1.4 },
  headSub: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4, marginTop: 4 },
  x: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  prepBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: colors.ink,
    backgroundColor: colors.white,
  },
  prepLbl: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2, color: colors.ink },
  prepBadge: { paddingHorizontal: 10, paddingVertical: 4, borderWidth, borderColor: colors.ink },
  prepBadgeTxt: { fontSize: 11, fontWeight: "800", color: colors.ink },
  line: { backgroundColor: colors.white, borderWidth, borderColor: colors.ink, padding: 12, gap: 8 },
  lineTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  lineName: { flex: 1, fontSize: 13, fontWeight: "800", color: colors.ink, letterSpacing: 0.4 },
  linePrice: { fontSize: 13, fontWeight: "800", color: colors.ink },
  lineMid: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  miniPrep: { backgroundColor: colors.ink, paddingHorizontal: 8, paddingVertical: 3 },
  miniPrepTxt: { color: colors.gold, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  blurb: { fontSize: 12, color: colors.muted },
  lineBot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  each: { fontSize: 12, color: colors.muted },
  cashNote: { borderWidth, borderColor: colors.ink, padding: 12 },
  cashNoteTxt: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8, color: colors.ink },
  sum: { marginTop: 8, gap: 8 },
  sumRow: { flexDirection: "row", justifyContent: "space-between" },
  sumLbl: { color: colors.muted, fontSize: 13 },
  sumVal: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  rule: { height: 1, backgroundColor: colors.ink, marginVertical: 4 },
  due: { fontSize: 13, fontWeight: "800", letterSpacing: 1, color: colors.ink },
  dueAmt: { fontSize: 20, fontWeight: "800", color: colors.ink },
  cta: {
    margin: 14,
    minHeight: 52,
    backgroundColor: colors.ink,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderWidth,
    borderColor: colors.ink,
  },
  ctaTxt: { color: colors.white, fontSize: 13, fontWeight: "800", letterSpacing: 1.6 },
  ctaPrice: { fontSize: 16, fontWeight: "800" },
});
