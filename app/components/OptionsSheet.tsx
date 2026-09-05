import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Photo, Stepper } from "@/components/ui";
import { money } from "@/lib/format";
import { hapticLight } from "@/lib/haptics";
import { borderWidth, colors, radius, type } from "@/lib/theme";
import { surchargeDefaults, type MenuItem, type MilkOption } from "@/lib/types";
import { useStore } from "@/lib/store";

function Inner({
  item,
  accent,
  onClose,
  onAdd,
}: {
  item: MenuItem;
  accent: string;
  onClose: () => void;
  onAdd: (opts: { milk?: MilkOption; extraShot?: boolean }, qty: number) => void;
}) {
  const { cafe } = useStore();
  const [milk, setMilk] = useState<MilkOption>("whole");
  const [shot, setShot] = useState(false);
  const [qty, setQty] = useState(1);
  const sur = surchargeDefaults(cafe?.currency);
  const altMilk = Number.isFinite(Number(cafe?.altMilkPrice)) ? Number(cafe.altMilkPrice) : sur.altMilk;
  const extraShot = Number.isFinite(Number(cafe?.extraShotPrice)) ? Number(cafe.extraShotPrice) : sur.extraShot;
  const cur = cafe?.currency || "USD";

  const milks: { id: MilkOption; label: string; extra: number }[] = [
    { id: "whole", label: "Whole", extra: 0 },
    { id: "oat", label: "Oat", extra: altMilk },
    { id: "almond", label: "Almond", extra: altMilk },
    { id: "skim", label: "Skim", extra: 0 },
  ];

  let unit = item.price;
  if (item.hasMilk && (milk === "oat" || milk === "almond")) unit += altMilk;
  if (item.hasExtraShot && shot) unit += extraShot;
  const total = unit * qty;

  return (
    <View style={styles.sheet}>
      <View>
        <Photo uri={item.image} height={220}>
          <Pressable onPress={onClose} accessibilityLabel="Close" style={styles.close}>
            <Text style={styles.closeX}>✕</Text>
          </Pressable>
          <View style={[styles.prep, { backgroundColor: accent }]}>
            <Text style={styles.prepTxt}>EST. PREP: {item.prepMinutes} MINS</Text>
          </View>
        </Photo>
      </View>
      <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name}>{item.name.toUpperCase()}</Text>
          <Text style={styles.price}>{money(item.price)}</Text>
        </View>
        <Text style={styles.desc}>{item.description}</Text>

        {item.hasMilk ? (
          <View style={{ marginTop: 18 }}>
            <Text style={styles.lbl}>Milk</Text>
            <View style={styles.row}>
              {milks.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => setMilk(m.id)}
                  style={[styles.opt, milk === m.id && { backgroundColor: colors.ink }]}
                >
                  <Text style={[styles.optT, milk === m.id && { color: colors.white }]}>
                    {m.label}
                    {m.extra ? ` +${money(m.extra, cur)}` : ""}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {item.hasExtraShot ? (
          <Pressable
            onPress={() => setShot((v) => !v)}
            style={[styles.shot, shot && { backgroundColor: colors.wash }]}
          >
            <Text style={{ fontWeight: "800", color: colors.ink, letterSpacing: 0.6 }}>EXTRA SHOT</Text>
            <Text style={{ color: colors.muted, fontWeight: "700" }}>+{money(extraShot, cur)}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <View style={styles.foot}>
        <Stepper
          qty={qty}
          onDec={() => setQty((q) => Math.max(1, q - 1))}
          onInc={() => setQty((q) => q + 1)}
        />
        <Pressable
          onPress={() => {
            void hapticLight();
            onAdd(
              {
                milk: item.hasMilk ? milk : undefined,
                extraShot: item.hasExtraShot ? shot : undefined,
              },
              qty,
            );
          }}
          style={styles.addOrder}
          accessibilityRole="button"
          accessibilityLabel="Add to order"
        >
          <Text style={styles.addOrderTxt}>ADD TO ORDER</Text>
          <View style={[styles.priceInset, { backgroundColor: accent }]}>
            <Text style={styles.priceInsetTxt}>{money(total, cur)}</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

export function OptionsSheet({
  item,
  accent,
  onClose,
  onAdd,
}: {
  item: MenuItem | null;
  accent: string;
  onClose: () => void;
  onAdd: (opts: { milk?: MilkOption; extraShot?: boolean }, qty: number) => void;
}) {
  if (!item) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.bak}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close options" />
        <View style={styles.center}>
          <Inner key={item.id} item={item} accent={accent} onClose={onClose} onAdd={onAdd} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bak: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  center: { width: "100%", maxWidth: 460 },
  sheet: {
    backgroundColor: colors.bg,
    borderWidth,
    borderColor: colors.line,
    borderRadius: radius,
    overflow: "hidden",
  },
  close: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  closeX: { color: colors.white, fontSize: 14, fontWeight: "800" },
  prep: {
    position: "absolute",
    left: 12,
    bottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth,
    borderColor: colors.ink,
  },
  prepTxt: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: colors.ink,
  },
  body: { padding: 18, paddingBottom: 8 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  name: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: colors.ink,
  },
  price: { fontSize: 18, fontWeight: "800", color: colors.ink },
  desc: { marginTop: 8, ...type.body, color: colors.ink },
  lbl: {
    fontSize: 11,
    letterSpacing: 1.6,
    fontWeight: "800",
    textTransform: "uppercase",
    color: colors.muted,
    marginBottom: 8,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  opt: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderWidth,
    borderColor: colors.ink,
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  optT: { fontSize: 13, fontWeight: "700", color: colors.ink },
  shot: {
    marginTop: 16,
    minHeight: 52,
    borderWidth,
    borderColor: colors.ink,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
  },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderColor: colors.ink,
    backgroundColor: colors.bg,
  },
  addOrder: {
    flex: 1,
    minHeight: 48,
    backgroundColor: colors.ink,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 14,
    paddingRight: 6,
    borderWidth,
    borderColor: colors.ink,
  },
  addOrderTxt: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  priceInset: { paddingHorizontal: 10, paddingVertical: 8, minWidth: 70, alignItems: "center" },
  priceInsetTxt: { fontWeight: "800", color: colors.ink, fontSize: 13 },
});
