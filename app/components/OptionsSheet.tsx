import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Photo, Stepper } from "@/components/ui";
import { money } from "@/lib/format";
import { hapticLight } from "@/lib/haptics";
import {
  effectiveModifiers,
  legacyFromSelections,
  priceWithSelections,
} from "@/lib/modifiers";
import { borderWidth, colors, radius, type } from "@/lib/theme";
import type { MenuItem, ModifierSelection } from "@/lib/types";
import { useStore } from "@/lib/store";

export type AddOpts = {
  milk?: string;
  extraShot?: boolean;
  selections?: ModifierSelection[];
};

function Inner({
  item,
  accent,
  onClose,
  onAdd,
}: {
  item: MenuItem;
  accent: string;
  onClose: () => void;
  onAdd: (opts: AddOpts, qty: number) => void;
}) {
  const { cafe } = useStore();
  const cur = cafe?.currency || "USD";
  const mods = useMemo(
    () =>
      effectiveModifiers(item, {
        currency: cafe?.currency,
        altMilkPrice: cafe?.altMilkPrice,
        extraShotPrice: cafe?.extraShotPrice,
      }),
    [item, cafe?.currency, cafe?.altMilkPrice, cafe?.extraShotPrice],
  );

  const [picked, setPicked] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const g of mods) {
      if (g.options[0]) init[g.id] = g.options[0].id;
    }
    return init;
  });
  const [qty, setQty] = useState(1);

  const selections: ModifierSelection[] = mods
    .filter((g) => picked[g.id])
    .map((g) => ({ groupId: g.id, optionId: picked[g.id] }));

  const unit = priceWithSelections(item.price, mods, selections);
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
      <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name}>{item.name.toUpperCase()}</Text>
          <Text style={styles.price}>{money(item.price, cur)}</Text>
        </View>
        <Text style={styles.desc}>{item.description}</Text>

        {mods.map((g) => (
          <View key={g.id} style={{ marginTop: 18 }}>
            <Text style={styles.lbl}>{g.name}</Text>
            <View style={styles.row}>
              {g.options.map((o) => {
                const on = picked[g.id] === o.id;
                return (
                  <Pressable
                    key={o.id}
                    onPress={() => setPicked((prev) => ({ ...prev, [g.id]: o.id }))}
                    style={[styles.opt, on && { backgroundColor: colors.ink }]}
                  >
                    <Text style={[styles.optT, on && { color: colors.white }]}>
                      {o.name}
                      {o.price ? ` +${money(o.price, cur)}` : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
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
            const legacy = legacyFromSelections(selections);
            onAdd(
              {
                selections,
                milk: legacy.milk,
                extraShot: legacy.extraShot,
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
  onAdd: (opts: AddOpts, qty: number) => void;
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
