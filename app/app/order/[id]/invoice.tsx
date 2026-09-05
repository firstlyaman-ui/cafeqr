import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { Btn, Loading, Screen } from "@/components/ui";
import { isGstSplit, money, optionBlurb, tableLabel, taxLabel } from "@/lib/format";
import { hapticMedium } from "@/lib/haptics";
import { diningLabel, shareReceipt } from "@/lib/share";
import { useStore } from "@/lib/store";
import { borderWidth, colors, radius } from "@/lib/theme";

function formatStamp(ts: number) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(ts);
  }
}

export default function OrderInvoice() {
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
      if (!r.ok && r.status === 401) setAuthErr("Confirm code required to view this receipt.");
      else if (!r.ok && !order) setAuthErr(r.error);
      else setAuthErr(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, id, confirm, apiOnline, fetchGuestOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) return <Loading />;
  if (!order) {
    return (
      <Screen maxWidth={560}>
        <Text style={styles.h}>Receipt not found</Text>
        <Text style={styles.sub}>{authErr || "Open this from a placed order on this device."}</Text>
        <Btn label="Back" href="/" variant="outline" />
      </Screen>
    );
  }

  const half = Math.round((order.tax / 2) * 100) / 100;

  const printReceipt = () => {
    void hapticMedium();
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.print();
    }
  };

  const onShare = async () => {
    void hapticMedium();
    await shareReceipt(cafe, order);
  };

  return (
    <Screen maxWidth={560}>
      <View {...({ className: "no-print", dataSet: { noprint: "true" } } as any)} style={{ marginBottom: 16, gap: 10 }}>
        <Text style={styles.k}>Receipt</Text>
        <Text style={styles.h}>Order invoice</Text>
        {Platform.OS === "web" ? <Btn label="Print" onPress={printReceipt} variant="gold" /> : null}
        <Btn label="Share on WhatsApp" onPress={() => void onShare()} variant="outline" />
        <Btn label="Back to order" href={`/order/${order.id}?confirm=${encodeURIComponent(order.confirmCode || "")}` as any} variant="outline" />
      </View>

      <View style={styles.receipt} accessibilityLabel="Printable receipt">
        <Text style={styles.cafe}>{cafe.name}</Text>
        <Text style={styles.tag}>{cafe.tagline || "Cash · table QR ordering"}</Text>
        <View style={styles.rule} />
        <Row k="Order" v={order.id} bold />
        <Row k="Table" v={tableLabel(order.table)} />
        <Row k="Type" v={diningLabel(order.diningOption)} />
        <Row k="Guest" v={order.guestName} />
        {order.confirmCode ? <Row k="Staff code" v={order.confirmCode} /> : null}
        <Row k="When" v={formatStamp(order.createdAt)} />
        <View style={styles.rule} />
        {order.items.map((line, i) => {
          const extra = optionBlurb(line.milk, line.extraShot, cafe);
          return (
            <View key={`${line.itemId}-${i}`} style={styles.line}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lineName}>
                  {line.qty}× {line.name}
                </Text>
                {extra ? <Text style={styles.extra}>{extra}</Text> : null}
              </View>
              <Text style={styles.lineAmt}>{money(line.unitPrice * line.qty, cur)}</Text>
            </View>
          );
        })}
        {order.notes ? <Text style={styles.notes}>Note: {order.notes}</Text> : null}
        <View style={styles.rule} />
        <Row k="Subtotal" v={money(order.subtotal, cur)} />
        {(() => {
          const name = order.taxName || cafe.taxName || "Tax";
          const rate = cafe.taxRate;
          if (isGstSplit(name, rate) && order.tax > 0) {
            return (
              <>
                <Row k="CGST (2.5%)" v={money(half, cur)} />
                <Row k="SGST (2.5%)" v={money(order.tax - half, cur)} />
              </>
            );
          }
          if (order.tax > 0) return <Row k={taxLabel(name, rate)} v={money(order.tax, cur)} />;
          return null;
        })()}
        <Row k="Total" v={money(order.total, cur)} bold />
        <View style={[styles.dueBox, { marginTop: 12 }]}>
          <Text style={styles.dueLbl}>{order.payCash ? "CASH DUE" : "AMOUNT DUE"}</Text>
          <Text style={styles.dueAmt}>{money(order.total, cur)}</Text>
        </View>
        <Text style={styles.foot}>Thank you · pay at the counter when you collect</Text>
      </View>
    </Screen>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rk, bold && styles.bold]}>{k}</Text>
      <Text style={[styles.rv, bold && styles.bold]}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  k: { fontSize: 11, fontWeight: "800", letterSpacing: 2, color: colors.gold, textTransform: "uppercase" },
  h: { fontSize: 26, fontWeight: "800", color: colors.ink, marginTop: 4 },
  sub: { color: colors.muted, marginVertical: 12, lineHeight: 20 },
  receipt: {
    backgroundColor: colors.white,
    borderWidth,
    borderColor: colors.line,
    borderRadius: radius,
    padding: 22,
    marginBottom: 40,
  },
  cafe: { fontSize: 22, fontWeight: "800", textAlign: "center", color: colors.ink, letterSpacing: 0.4 },
  tag: { textAlign: "center", color: colors.muted, marginTop: 4, marginBottom: 8, fontSize: 13 },
  rule: { height: 1, backgroundColor: colors.line, marginVertical: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 6 },
  rk: { color: colors.muted, fontSize: 14 },
  rv: { color: colors.ink, fontSize: 14, fontWeight: "600", textAlign: "right", flexShrink: 1 },
  bold: { fontWeight: "800", color: colors.ink },
  line: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 10 },
  lineName: { fontWeight: "700", color: colors.ink, fontSize: 14 },
  extra: { color: colors.muted, fontSize: 12, marginTop: 2 },
  lineAmt: { fontWeight: "800", color: colors.ink },
  notes: { color: colors.muted, fontStyle: "italic", marginTop: 4, fontSize: 13 },
  dueBox: {
    borderWidth,
    borderColor: colors.ink,
    borderRadius: radius,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.goldSoft,
  },
  dueLbl: { fontSize: 12, fontWeight: "800", letterSpacing: 1.4, color: colors.ink },
  dueAmt: { fontSize: 24, fontWeight: "800", color: colors.ink },
  foot: { textAlign: "center", color: colors.muted, marginTop: 18, fontSize: 12 },
});
