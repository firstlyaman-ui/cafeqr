import { useLocalSearchParams } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Btn, Loading, Screen } from "@/components/ui";
import { money, statusLabel, tableLabel, waitCopy } from "@/lib/format";
import { hapticMedium } from "@/lib/haptics";
import { diningLabel, shareReceipt } from "@/lib/share";
import { useStore } from "@/lib/store";
import { colors, radius } from "@/lib/theme";
import type { OrderStatus } from "@/lib/types";

const STEPS: OrderStatus[] = ["new", "preparing", "ready", "paid"];

export default function OrderStatusScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { orders, cafe, ready } = useStore();
  const cur = cafe.currency || "USD";
  if (!ready) return <Loading />;
  const order = orders.find((o) => o.id === id);

  if (!order) {
    return (
      <Screen maxWidth={560}>
        <Text style={styles.h}>ORDER NOT FOUND</Text>
        <Text style={styles.sub}>That ticket isn’t on the board. Ask staff, or start a new order.</Text>
        <Btn label="Back to CafeQR" href="/" />
      </Screen>
    );
  }

  const idx = STEPS.indexOf(order.status);
  const half = Math.round((order.tax / 2) * 100) / 100;

  return (
    <Screen maxWidth={560}>
      <Text style={styles.k}>Ticket {order.id}</Text>
      <Text style={styles.h}>WE HAVE YOUR ORDER</Text>
      <Text style={styles.sub}>
        {tableLabel(order.table)} · {diningLabel(order.diningOption)} · {order.guestName}. Status:{" "}
        {statusLabel(order.status)}.
      </Text>

      {order.status === "new" && order.confirmCode ? (
        <View style={styles.codeBox}>
          <Text style={styles.codeLbl}>Show this code to staff</Text>
          <Text style={styles.code}>{order.confirmCode}</Text>
        </View>
      ) : null}

      <View style={styles.track}>
        {STEPS.map((s, i) => (
          <View key={s} style={[styles.step, i <= idx && { backgroundColor: colors.ink }]}>
            <Text style={[styles.stepTxt, i <= idx && { color: colors.gold }]}>{statusLabel(s).toUpperCase()}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardK}>Pay at the counter</Text>
        <Text style={styles.big}>{money(order.total, cur)}</Text>
        <Text style={styles.pay}>
          {order.payCash ? "CASH ONLY — hand exact cash to the cashier when you collect." : "Pay when collecting."}
        </Text>
        <Text style={styles.wait}>Estimated wait {waitCopy(order.estimatedWait)}</Text>
      </View>

      <View style={styles.card}>
        {order.items.map((line, i) => (
          <View key={i} style={styles.row}>
            <Text style={{ flex: 1, fontWeight: "700" }}>
              {line.qty}× {line.name.toUpperCase()}
            </Text>
            <Text style={{ fontWeight: "800" }}>{money(line.unitPrice * line.qty, cur)}</Text>
          </View>
        ))}
        {cur === "INR" && order.tax > 0 ? (
          <>
            <View style={styles.row}>
              <Text style={{ color: colors.muted }}>CGST 2.5%</Text>
              <Text>{money(half, cur)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={{ color: colors.muted }}>SGST 2.5%</Text>
              <Text>{money(order.tax - half, cur)}</Text>
            </View>
          </>
        ) : null}
        {order.notes ? <Text style={{ color: colors.muted, marginTop: 8 }}>Note: {order.notes}</Text> : null}
      </View>

      <Btn
        label="Share on WhatsApp"
        onPress={() => {
          void hapticMedium();
          void shareReceipt(cafe, order);
        }}
        variant="gold"
      />
      <View style={{ height: 10 }} />
      <Btn label="Print receipt" href={`/order/${order.id}/invoice` as any} variant="outline" />
      <View style={{ height: 10 }} />
      <Btn label="Add more items" href={`/c/${cafe.slug || "velvet-bean"}/t/${order.table}` as any} variant="outline" />
      <View style={{ height: 10 }} />
      <Btn label="Staff board" href={`/staff?slug=${cafe.slug || "velvet-bean"}` as any} variant="outline" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  k: { fontSize: 11, fontWeight: "800", letterSpacing: 2, color: colors.gold, textTransform: "uppercase" },
  h: { fontSize: 28, fontWeight: "800", letterSpacing: 0.6, color: colors.ink, marginTop: 8 },
  sub: { color: colors.muted, marginTop: 8, marginBottom: 22, lineHeight: 22 },
  codeBox: {
    backgroundColor: colors.ink,
    borderRadius: radius,
    padding: 18,
    alignItems: "center",
    marginBottom: 18,
  },
  codeLbl: { color: colors.gold, fontSize: 11, fontWeight: "800", letterSpacing: 1.6, textTransform: "uppercase" },
  code: { color: colors.white, fontSize: 42, fontWeight: "800", letterSpacing: 8, marginTop: 8 },
  track: { flexDirection: "row", gap: 6, marginBottom: 18, flexWrap: "wrap" },
  step: {
    flexGrow: 1,
    minWidth: 70,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: colors.white,
  },
  stepTxt: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: colors.ink },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  cardK: { fontSize: 11, fontWeight: "800", letterSpacing: 1.6, textTransform: "uppercase", color: colors.muted },
  big: { fontSize: 36, fontWeight: "800", color: colors.ink },
  pay: { fontSize: 13, fontWeight: "700", color: colors.ink, letterSpacing: 0.4 },
  wait: { color: colors.muted, fontWeight: "700" },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
});
