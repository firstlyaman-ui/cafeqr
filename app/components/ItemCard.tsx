import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AddBtn, Photo, Stepper, Tag } from "@/components/ui";
import { money } from "@/lib/format";
import { borderWidth, colors, radius, shadow } from "@/lib/theme";
import type { MenuItem } from "@/lib/types";

export function ItemCard({
  item,
  categoryName,
  qty,
  onOpen,
  onAdd,
  onInc,
  onDec,
  currency = "USD",
}: {
  item: MenuItem;
  categoryName: string;
  qty: number;
  onOpen: () => void;
  onAdd: () => void;
  onInc: () => void;
  onDec: () => void;
  currency?: string;
}) {
  return (
    <View style={styles.card}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={item.name}>
        <Photo uri={item.image} height={168}>
          <View style={styles.badges}>
            {item.tags.includes("popular") ? <Tag label="Popular" gold /> : null}
            {item.tags.includes("veg") ? <Tag label="Veg" /> : null}
            {item.tags.includes("vegan") ? <Tag label="Vegan" dark /> : null}
            {item.tags.includes("gf") ? <Tag label="GF" /> : null}
          </View>
          <View style={styles.priceBadge}>
            <Text style={styles.priceTxt}>{money(item.price, currency)}</Text>
          </View>
          <View style={styles.prep}>
            <Text style={styles.prepTxt}>PREP: {item.prepMinutes} MINS</Text>
          </View>
        </Photo>
        <View style={styles.body}>
          <Text style={styles.name}>{item.name.toUpperCase()}</Text>
          <Text style={styles.desc} numberOfLines={2}>
            {item.description}
          </Text>
        </View>
      </Pressable>
      <View style={[styles.foot, { paddingHorizontal: 12, paddingBottom: 12 }]}>
        <Text style={styles.cat}>
          {categoryName.toUpperCase()}
          {item.hasMilk || item.hasExtraShot ? "  ·  OPTIONS" : ""}
        </Text>
        {qty > 0 ? (
          <Stepper qty={qty} onDec={onDec} onInc={onInc} />
        ) : (
          <AddBtn
            onPress={onAdd}
            label={item.hasMilk || item.hasExtraShot ? "+ OPTIONS" : "+ ADD"}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth,
    borderColor: colors.line,
    borderRadius: radius,
    marginBottom: 0,
    overflow: "hidden",
    ...shadow.card,
  },
  badges: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 70,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  priceBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: colors.white,
    borderWidth,
    borderColor: colors.ink,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  priceTxt: { fontWeight: "800", color: colors.ink, fontSize: 13 },
  prep: {
    position: "absolute",
    left: 10,
    bottom: 10,
    backgroundColor: "rgba(29,29,27,0.78)",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  prepTxt: { color: colors.white, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  body: { padding: 12, gap: 6 },
  name: { fontSize: 14, fontWeight: "800", letterSpacing: 0.5, color: colors.ink },
  desc: { fontSize: 13, lineHeight: 18, color: colors.muted },
  foot: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cat: { flex: 1, fontSize: 10, letterSpacing: 1, fontWeight: "700", color: colors.faint },
});
