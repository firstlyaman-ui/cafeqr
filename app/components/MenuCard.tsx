import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { Tag } from "@/components/ui";
import { money } from "@/lib/format";
import type { MenuItem } from "@/lib/types";
import { colors } from "@/lib/theme";

export function MenuCard({
  item,
  accent,
  onAdd,
}: {
  item: MenuItem;
  accent: string;
  onAdd: () => void;
}) {
  return (
    <View style={styles.card}>
      <View>
        <Image source={{ uri: item.image }} style={styles.img} accessibilityLabel={item.name} />
        {item.tags.includes("popular") ? (
          <View style={[styles.pop, { backgroundColor: accent }]}>
            <Text style={styles.popT}>Popular</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.desc} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.price}>{money(item.price)}</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.mins}>{item.prepMinutes} min</Text>
        </View>
        <View style={styles.bottom}>
          <View style={styles.tags}>
            {item.tags.includes("veg") ? <Tag label="Veg" /> : null}
            {item.tags.includes("vegan") ? <Tag label="Vegan" /> : null}
            {item.tags.includes("gf") ? <Tag label="GF" /> : null}
          </View>
          <Pressable
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel={`Add ${item.name}`}
            style={styles.add}
          >
            <Text style={styles.addT}>Add</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 16,
    minWidth: 0,
  },
  img: { width: "100%", height: 160, backgroundColor: colors.wash },
  pop: {
    position: "absolute",
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  popT: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.ink,
  },
  body: { padding: 12, gap: 6 },
  name: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.ink,
  },
  desc: { fontSize: 13, lineHeight: 18, color: colors.muted },
  meta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  price: { fontSize: 15, fontWeight: "700", color: colors.ink },
  dot: { color: colors.faint },
  mins: { fontSize: 12, color: colors.muted },
  bottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, flex: 1, paddingRight: 8 },
  add: {
    minWidth: 52,
    minHeight: 44,
    backgroundColor: colors.dark,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  addT: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 1.4, textTransform: "uppercase" },
});
