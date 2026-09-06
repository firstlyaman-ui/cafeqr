import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Btn, Loading, Screen } from "@/components/ui";
import { isGstSplit, money, statusLabel, tableLabel, taxLabel, waitCopy } from "@/lib/format";
import { hapticMedium } from "@/lib/haptics";
import { diningLabel, shareReceipt } from "@/lib/share";
import { useStore } from "@/lib/store";
import { colors, radius } from "@/lib/theme";
import type { OrderStatus } from "@/lib/types";

const STEPS: OrderStatus[] = ["new", "preparing", "ready", "paid"];

export default function OrderStatusScreen() {
  const { id, confirm } = useLocalSearchParams<{ id: string; confirm?: string }>();
  const { orders, cafe, ready, fetchGuestOrder, apiOnline } = useStore();
  const cur = cafe.currency || "USD";
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const order = orders.find((o) => o.id === id);

  useEffect(() => {
    if (!ready || !id || !apiOnline) return;
    let cancelled = false;
    let stop = false;
    const tick = async (showLoading: boolean) => {
      if (stop || cancelled) return;
      const code =
        (typeof confirm === "string" && confirm) ||
        orders.find((o) => o.id === id)?.confirmCode ||
        "";
      if (showLoading) setLoadingRemote(true);
      const r = await fetchGuestOrder(String(id), code || undefined);
      if (cancelled) return;
      if (showLoading) setLoadingRemote(false);
      if (!r.ok) {
        if (r.status === 401) setAuthErr("This order needs a confirm code. Open the link from your receipt.");
        else if (!orders.find((o) => o.id === id)) setAuthErr(r.error);
      } else {
        setAuthErr(null);
        if (r.order.status === "paid") stop = true;
      }
    };
    void tick(true);
    const timer = setInterval(() => {
      void tick(false);
    }, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [ready, id, confirm, apiOnline, fetchGuestOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready || (loadingRemote && !order)) return <Loading />;

  if (!order) {
    return (
      <Screen maxWidth={560}>
        <Text style={styles.h}>ORDER NOT FOUND</Text>
        <Text style={styles.sub}>
          {authErr || "That ticket isn’t on the board. Ask staff, or start a new order."}
        </Text>
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
      {authErr ? <Text style={[styles.sub, { color: "#B00020" }]}>{authErr}</Text> : null}

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
        {(() => {
          const name = order.taxName || cafe.taxName || "Tax";
          const rate = cafe.taxRate;
          if (!(order.tax > 0)) return null;
          if (isGstSplit(name, rate)) {
            return (
              <>
                <View style={styles.row}>
                  <Text style={{ color: colors.muted }}>CGST (2.5%)</Text>
                  <Text>{money(half, cur)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={{ color: colors.muted }}>SGST (2.5%)</Text>
                  <Text>{money(order.tax - half, cur)}</Text>
                </View>
              </>
            );
          }
          return (
            <View style={styles.row}>
              <Text style={{ color: colors.muted }}>{taxLabel(name, rate)}</Text>
              <Text>{money(order.tax, cur)}</Text>
            </View>
          );
        })()}
        <View style={[styles.row, { marginTop: 8 }]}>
          <Text style={{ fontWeight: "800" }}>TOTAL</Text>
          <Text style={{ fontWeight: "800" }}>{money(order.total, cur)}</Text>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Btn
          label="Share on WhatsApp"
          onPress={() => {
            void hapticMedium();
            void shareReceipt(cafe, order);
          }}
          variant="gold"
        />
        <Btn label="Print receipt" href={`/order/${order.id}/invoice?confirm=${order.confirmCode || ""}` as any} variant="outline" />
        <Btn label="Back to menu" href={`/c/${cafe.slug || "velvet-bean"}/t/${order.table}` as any} variant="outline" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  k: { fontSize: 11, fontWeight: "800", letterSpacing: 2, color: colors.gold, textTransform: "uppercase" },
  h: { fontSize: 28, fontWeight: "800", letterSpacing: 0.4, color: colors.ink, marginTop: 8 },
  sub: { color: colors.muted, marginTop: 10, marginBottom: 18, lineHeight: 22 },
  codeBox: {
    backgroundColor: colors.ink,
    borderRadius: radius,
    padding: 18,
    alignItems: "center",
    marginBottom: 16,
  },
  codeLbl: { color: colors.gold, fontSize: 11, fontWeight: "800", letterSpacing: 1.6, textTransform: "uppercase" },
  code: { color: colors.white, fontSize: 42, fontWeight: "800", letterSpacing: 8, marginTop: 8 },
  track: { flexDirection: "row", gap: 6, marginBottom: 16, flexWrap: "wrap" },
  step: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: colors.line },
  stepTxt: { fontSize: 10, fontWeight: "800", color: colors.muted },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
    padding: 16,
    gap: 10,
    marginBottom: 14,
  },
  cardK: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4, color: colors.muted, textTransform: "uppercase" },
  big: { fontSize: 36, fontWeight: "800", color: colors.ink },
  pay: { color: colors.muted, lineHeight: 20 },
  wait: { color: colors.ink, fontWeight: "700" },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "center" },
});
