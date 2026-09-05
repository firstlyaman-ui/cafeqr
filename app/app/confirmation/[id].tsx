import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Btn, Loading, Screen } from "@/components/ui";
import { money, tableLabel, waitCopy } from "@/lib/format";
import { hapticMedium } from "@/lib/haptics";
import { diningLabel, shareReceipt } from "@/lib/share";
import { useStore } from "@/lib/store";
import { colors, radius } from "@/lib/theme";

export default function Confirmation() {
  const { id, confirm } = useLocalSearchParams<{ id: string; confirm?: string }>();
  const { orders, cafe, ready, fetchGuestOrder, apiOnline } = useStore();
  const cur = cafe.currency || "USD";
  const [authErr, setAuthErr] = useState<string | null>(null);
  const order = orders.find((o) => o.id === id);

  useEffect(() => {
    if (!ready || !id || !apiOnline) return;
    const code = (typeof confirm === "string" && confirm) || order?.confirmCode || "";
    let cancelled = false;
    void (async () => {
      const r = await fetchGuestOrder(String(id), code || undefined);
      if (cancelled) return;
      if (!r.ok && r.status === 401) {
        setAuthErr("Confirm code required to view this order.");
      } else if (!r.ok && !order) {
        setAuthErr(r.error);
      } else {
        setAuthErr(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, id, confirm, apiOnline, fetchGuestOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) return <Loading />;
  if (!order) {
    return (
      <Screen maxWidth={640}>
        <Text style={styles.h}>Order not found</Text>
        <Text style={styles.sub}>{authErr || "It may have been cleared from this device."}</Text>
        <Btn label="Back to menu" href={`/c/${cafe.slug || "velvet-bean"}/t/04` as any} />
      </Screen>
    );
  }

  const confQ = order.confirmCode ? `?confirm=${encodeURIComponent(order.confirmCode)}` : "";

  return (
    <Screen maxWidth={640}>
      <Text style={styles.k}>Order received</Text>
      <Text style={styles.h}>{order.id}</Text>
      <Text style={styles.sub}>
        {tableLabel(order.table)} · {diningLabel(order.diningOption)} at {cafe.name}. The ticket is on the kitchen board.
      </Text>
      {authErr ? <Text style={[styles.sub, { color: "#B00020" }]}>{authErr}</Text> : null}

      {order.confirmCode ? (
        <View style={styles.codeBox}>
          <Text style={styles.codeLbl}>Show this code to staff</Text>
          <Text style={styles.code}>{order.confirmCode}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Row k="Pay at counter" v={money(order.total, cur)} />
        <Row k="Estimated wait" v={waitCopy(order.estimatedWait)} />
        <Row k="Type" v={diningLabel(order.diningOption)} />
        <Row k="Payment" v="Cash only — no card" />
        <Row k="Guest" v={order.guestName} />
      </View>

      <Text style={styles.help}>
        Walk to the counter with this number. Staff will confirm your code before the kitchen starts. Pay cash when you
        pick up.
      </Text>

      <View style={{ gap: 10 }}>
        <Btn
          label="Share on WhatsApp"
          onPress={() => {
            void hapticMedium();
            void shareReceipt(cafe, order);
          }}
          variant="gold"
        />
        <Btn label="Track this order" onPress={() => router.push(`/order/${order.id}${confQ}` as any)} variant="outline" />
        <Btn label="Print receipt" href={`/order/${order.id}/invoice${confQ}` as any} variant="outline" />
        <Btn label="Add more items" href={`/c/${cafe.slug || "velvet-bean"}/t/${order.table}` as any} variant="outline" />
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
  codeBox: {
    backgroundColor: colors.ink,
    borderRadius: radius,
    padding: 18,
    alignItems: "center",
    marginBottom: 16,
  },
  codeLbl: { color: colors.gold, fontSize: 11, fontWeight: "800", letterSpacing: 1.6, textTransform: "uppercase" },
  code: { color: colors.white, fontSize: 42, fontWeight: "800", letterSpacing: 8, marginTop: 8 },
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
