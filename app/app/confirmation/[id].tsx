import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Btn, Loading, Screen } from "@/components/ui";
import { money, tableLabel, waitCopy } from "@/lib/format";
import { trackPageview } from "@/lib/google";
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
    trackPageview(`/confirmation/${id}`, "Order confirmation");
  }, [id]);

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
  const shortId = order.id;

  return (
    <Screen maxWidth={640}>
      <Text style={styles.k}>Pay at the counter</Text>
      <Text style={styles.h}>SHOW THIS TO STAFF</Text>
      <Text style={styles.sub}>
        {tableLabel(order.table)} · {diningLabel(order.diningOption)} at {cafe.name}. Cash only.
      </Text>
      {authErr ? <Text style={[styles.sub, { color: "#B00020" }]}>{authErr}</Text> : null}

      <View style={styles.hero}>
        <Text style={styles.heroLbl}>Order number</Text>
        <Text style={styles.heroId} selectable>
          {shortId}
        </Text>
        {order.confirmCode ? (
          <>
            <Text style={[styles.heroLbl, { marginTop: 18 }]}>PIN</Text>
            <Text style={styles.heroPin} selectable>
              {order.confirmCode}
            </Text>
          </>
        ) : null}
      </View>

      <View style={styles.payBox}>
        <Text style={styles.payTitle}>Pay at counter with order # and PIN</Text>
        <Text style={styles.payBody}>
          Hand cash to staff. They confirm your PIN, then the kitchen starts. Estimated wait{" "}
          {waitCopy(order.estimatedWait)}.
        </Text>
        <Text style={styles.payAmt}>{money(order.total, cur)}</Text>
      </View>

      <View style={styles.card}>
        <Row k="Type" v={diningLabel(order.diningOption)} />
        <Row k="Guest" v={order.guestName} />
        <Row k="Payment" v="Cash only — no card" />
      </View>

      <View style={{ gap: 10 }}>
        <Btn
          label="Track this order"
          onPress={() => router.push(`/order/${order.id}${confQ}` as any)}
          variant="gold"
        />
        <Btn
          label="Share on WhatsApp"
          onPress={() => {
            void hapticMedium();
            void shareReceipt(cafe, order);
          }}
          variant="outline"
        />
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
  h: { fontSize: 26, fontWeight: "800", letterSpacing: 0.4, color: colors.ink, marginTop: 8 },
  sub: { color: colors.muted, marginTop: 10, marginBottom: 18, lineHeight: 22 },
  hero: {
    backgroundColor: colors.ink,
    borderRadius: radius,
    paddingVertical: 28,
    paddingHorizontal: 18,
    alignItems: "center",
    marginBottom: 14,
  },
  heroLbl: { color: colors.gold, fontSize: 11, fontWeight: "800", letterSpacing: 1.8, textTransform: "uppercase" },
  heroId: { color: colors.white, fontSize: 36, fontWeight: "800", letterSpacing: 1, marginTop: 8, textAlign: "center" },
  heroPin: { color: colors.gold, fontSize: 48, fontWeight: "800", letterSpacing: 10, marginTop: 6 },
  payBox: {
    backgroundColor: "#FFF8E8",
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: radius,
    padding: 16,
    marginBottom: 14,
    gap: 8,
  },
  payTitle: { fontWeight: "800", fontSize: 16, color: colors.ink },
  payBody: { color: colors.muted, lineHeight: 21 },
  payAmt: { fontSize: 28, fontWeight: "800", color: colors.ink, marginTop: 4 },
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
});
