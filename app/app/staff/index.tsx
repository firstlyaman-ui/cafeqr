import { useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { PinGate } from "@/components/PinGate";
import { Btn, Chip, Loading, Screen } from "@/components/ui";
import { money, nextStatus, nextStatusLabel, statusLabel, tableLabel, timeAgo } from "@/lib/format";
import { diningLabel } from "@/lib/share";
import { useStore } from "@/lib/store";
import { hapticMedium, hapticSuccess } from "@/lib/haptics";
import { borderWidth, colors, radius, shadow } from "@/lib/theme";
import { STAFF_PIN, type Order, type OrderStatus } from "@/lib/types";

const FILTERS: (OrderStatus | "all")[] = ["all", "new", "preparing", "ready", "paid"];

function Ticket({
  order,
  currency,
  onAdvance,
  onReject,
}: {
  order: Order;
  currency: string;
  onAdvance: (id: string, s: OrderStatus) => void;
  onReject: (id: string) => void;
}) {
  const nxt = nextStatus(order.status);
  const due = order.status !== "paid";
  const primary = nextStatusLabel(order.status, order.confirmCode);
  return (
    <View style={styles.ticket}>
      <View style={styles.ticketTop}>
        <Text style={styles.tid}>{order.id}</Text>
        <View style={[styles.st, order.status === "ready" && { backgroundColor: colors.ready }, order.status === "paid" && { backgroundColor: colors.muted }]}>
          <Text style={styles.stTxt}>{statusLabel(order.status).toUpperCase()}</Text>
        </View>
      </View>
      <Text style={styles.table}>
        {tableLabel(order.table)} · {diningLabel(order.diningOption)} · {order.guestName}
      </Text>
      {order.status === "new" && order.confirmCode ? (
        <Text style={styles.code}>CODE {order.confirmCode}</Text>
      ) : null}
      <Text style={styles.ago}>{timeAgo(order.createdAt)}</Text>
      {order.items.map((l, i) => (
        <Text key={`${l.itemId}-${l.milk ?? ""}-${l.extraShot ? "x" : ""}-${i}`} style={styles.line}>
          {l.qty}× {l.name}
        </Text>
      ))}
      {order.notes ? <Text style={styles.notes}>Note: {order.notes}</Text> : null}
      <View style={styles.dueRow}>
        <Text style={styles.dueLbl}>{due ? "CASH DUE" : "PAID"}</Text>
        <Text style={styles.dueAmt}>{money(order.total, currency)}</Text>
      </View>
      {nxt ? (
        <Btn
          label={primary || "Advance"}
          onPress={() => {
            void hapticMedium();
            onAdvance(order.id, nxt);
          }}
          variant={order.status === "ready" ? "gold" : "dark"}
        />
      ) : null}
      {order.status === "new" ? (
        <Btn
          label="Reject"
          variant="outline"
          onPress={() => {
            void hapticMedium();
            onReject(order.id);
          }}
        />
      ) : null}
    </View>
  );
}

export default function Staff() {
  const params = useLocalSearchParams<{ slug?: string }>();
  const {
    ready,
    staffOk,
    setStaffOk,
    orders,
    cafe,
    cafeSlug,
    cafeList,
    apiOnline,
    setOrderStatus,
    rejectOrder,
    loadCafe,
    refreshOrders,
    refreshCafeList,
    verifyStaffPin,
  } = useStore();
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [picked, setPicked] = useState(String(params.slug || cafeSlug || "velvet-bean"));

  useFocusEffect(
    useCallback(() => {
      void refreshCafeList();
      void loadCafe(String(params.slug || picked || cafeSlug || "velvet-bean"));
    }, [refreshCafeList, loadCafe, params.slug, picked, cafeSlug]),
  );

  useEffect(() => {
    const slug = String(params.slug || picked || "velvet-bean");
    setPicked(slug);
    void loadCafe(slug);
  }, [params.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!staffOk || !apiOnline) return;
    void refreshOrders();
    const id = setInterval(() => {
      void refreshOrders();
    }, 4000);
    return () => clearInterval(id);
  }, [staffOk, apiOnline, cafeSlug, refreshOrders]);

  const list = useMemo(() => {
    const src = orders.slice().sort((a, b) => b.createdAt - a.createdAt);
    if (filter === "all") return src;
    return src.filter((o) => o.status === filter);
  }, [orders, filter]);

  const cur = cafe.currency || "USD";
  const due = orders.filter((o) => o.status !== "paid").reduce((n, o) => n + o.total, 0);
  const slug = cafe.slug || cafeSlug || picked;

  if (!ready) return <Loading />;
  if (!staffOk) {
    return (
      <PinGate
        title="Staff board"
        hint={cafe.name || "Pass & tickets"}
        pin={STAFF_PIN}
        onCheck={(p) => verifyStaffPin(p)}
        onOk={() => {
          void hapticSuccess();
          setStaffOk(true);
        }}
      />
    );
  }

  return (
    <Screen maxWidth={1080}>
      <View style={styles.top}>
        <View>
          <Text style={styles.k}>
            {cafe.name} · {apiOnline ? "LIVE" : "LOCAL"}
          </Text>
          <Text style={styles.h}>STAFF BOARD</Text>
          <Text style={styles.sub}>Open tickets · cash due {money(due, cur)}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Btn label="Owner" href={`/owner?slug=${slug}` as any} variant="outline" />
          <Btn label="Table 4" href={`/c/${slug}/t/04` as any} variant="gold" />
          <Btn label="QR sheet" href="/staff/qr" variant="outline" />
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 12, gap: 8 }}>
        {(cafeList.length ? cafeList : [{ slug: "velvet-bean", name: cafe.name }]).map((c) => (
          <Chip
            key={c.slug}
            label={c.name}
            active={slug === c.slug}
            onPress={() => {
              setStaffOk(false);
              setPicked(c.slug);
              void loadCafe(c.slug);
            }}
          />
        ))}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 16 }}>
        {FILTERS.map((f) => (
          <Chip key={f} label={f === "all" ? "All" : statusLabel(f)} active={filter === f} onPress={() => setFilter(f)} />
        ))}
      </View>

      <View style={styles.board}>
        {(["new", "preparing", "ready", "paid"] as OrderStatus[])
          .filter((col) => filter === "all" || filter === col)
          .map((col) => {
            const colOrders = orders.filter((o) => o.status === col);
            return (
              <View key={col} style={styles.col}>
                <Text style={styles.colH}>
                  {statusLabel(col).toUpperCase()} · {colOrders.length}
                </Text>
                {colOrders.map((o) => (
                  <Ticket
                    key={o.id}
                    order={o}
                    currency={cur}
                    onAdvance={(id, s) => void setOrderStatus(id, s)}
                    onReject={(id) => void rejectOrder(id)}
                  />
                ))}
                {!colOrders.length ? <Text style={styles.empty}>None</Text> : null}
              </View>
            );
          })}
      </View>

      {filter !== "all" && !list.length ? (
        <Text style={styles.empty}>No {statusLabel(filter as OrderStatus).toLowerCase()} tickets.</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" },
  k: { fontSize: 11, fontWeight: "800", letterSpacing: 2, color: colors.gold, textTransform: "uppercase" },
  h: { fontSize: 28, fontWeight: "800", letterSpacing: 0.6, color: colors.ink, marginTop: 6 },
  sub: { color: colors.muted, marginTop: 6, fontWeight: "600" },
  board: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "flex-start" },
  col: { flexGrow: 1, flexBasis: 240, gap: 10, minWidth: 220 },
  colH: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
    color: colors.ink,
    borderBottomWidth: 1,
    borderColor: colors.line,
    paddingBottom: 8,
  },
  ticket: {
    backgroundColor: colors.white,
    borderWidth,
    borderColor: colors.line,
    borderRadius: radius,
    padding: 14,
    gap: 8,
    ...shadow.card,
  },
  ticketTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tid: { fontWeight: "800", letterSpacing: 1, color: colors.ink },
  st: { backgroundColor: colors.ink, paddingHorizontal: 8, paddingVertical: 3 },
  stTxt: { color: colors.gold, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  table: { fontWeight: "800", color: colors.ink, fontSize: 13 },
  code: { fontSize: 16, fontWeight: "800", letterSpacing: 2, color: colors.gold },
  ago: { color: colors.muted, fontSize: 12 },
  line: { fontSize: 13, color: colors.ink },
  notes: { fontSize: 12, color: colors.muted, fontStyle: "italic" },
  dueRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4, marginBottom: 4 },
  dueLbl: { fontSize: 10, fontWeight: "800", letterSpacing: 1.4, color: colors.muted },
  dueAmt: { fontWeight: "800", fontSize: 16, color: colors.ink },
  empty: { color: colors.muted, fontSize: 13, marginTop: 8 },
});
