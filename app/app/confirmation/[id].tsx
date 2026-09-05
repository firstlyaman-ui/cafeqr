import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Btn, Loading, Screen } from "@/components/ui";
import { money, tableLabel, waitCopy } from "@/lib/format";
import { useStore } from "@/lib/store";
import { colors, radius } from "@/lib/theme";

export default function Confirmation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { orders, cafe, ready } = useStore();
  const cur = cafe.currency || "USD";
  const order = orders.find((o) => o.id === id);

  if (!ready) return <Loading />;
  if (!order) {
    return (
      <Screen maxWidth={640}>
        <Text style={styles.h}>Order not found</Text>
        <Text style={styles.sub}>It may have been cleared from this device.</Text>
        <Btn label="Back to menu" href={`/c/${cafe.slug || "velvet-bean"}/t/04` as any} />
      </Screen>
    );
  }

  return (
    <Screen maxWidth={640}>
      <Text style={styles.k}>Order received</Text>
      <Text style={styles.h}>{order.id}</Text>
      <Text style={styles.sub}>
        {tableLabel(order.table)} at {cafe.name}. The ticket is on the kitchen board.
      </Text>

      <View style={styles.card}>
        <Row k="Pay at counter" v={money(order.total, cur)} />
        <Row k="Estimated wait" v={waitCopy(order.estimatedWait)} />
        <Row k="Payment" v="Cash only — no card" />
        <Row k="Guest" v={order.guestName} />
      </View>

      <Text style={styles.help}>
        Walk to the counter with this number. Staff will call{" "}
        {order.guestName === "Guest" ? "your table" : order.guestName} when it is ready. Pay cash
        when you pick up.
      </Text>

      <View style={{ gap: 10 }}>
        <Btn label="Track this order" onPress={() => router.push(`/order/${order.id}` as any)} variant="gold" />
        <Btn label="Print receipt" href={`/order/${order.id}/invoice` as any} variant="outline" />
        <Btn label="Back to menu" href={`/c/${cafe.slug || "velvet-bean"}/t/${order.table}` as any} variant="outline" />
      </View>
    </Screen>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rk}>{k}</Text>
      <Text style={styles.rv}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  k: { fontSize: 11, fontWeight: "800", letterSpacing: 2, color: colors.gold, textTransform: "uppercase" },
  h: { fontSize: 32, fontWeight: "800", letterSpacing: 0.4, color: colors.ink, marginTop: 8 },
  sub: { color: colors.muted, marginTop: 10, marginBottom: 22, lineHeight: 22 },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  rk: { color: colors.muted, fontSize: 14 },
  rv: { fontWeight: "800", color: colors.ink, fontSize: 14, textAlign: "right", flexShrink: 1 },
  help: { color: colors.muted, fontSize: 15, lineHeight: 22, marginBottom: 20 },
});
