import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/lib/theme";

/** Rotates owner-set cafe messages under the cafe name (~4s). */
export function HeaderTicker({ messages, accent }: { messages: string[]; accent?: string }) {
  const lines = (messages || []).map((m) => String(m || "").trim()).filter(Boolean);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
    if (lines.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % lines.length), 4000);
    return () => clearInterval(t);
  }, [lines.join("\n")]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!lines.length) return null;
  const msg = lines[idx % lines.length];

  return (
    <View style={[styles.wrap, accent ? { borderLeftColor: accent } : null]}>
      <Text style={styles.msg} numberOfLines={2}>
        {msg}
      </Text>
      {lines.length > 1 ? (
        <View style={styles.dots}>
          {lines.map((_, i) => (
            <View key={i} style={[styles.dot, i === idx % lines.length && styles.dotOn]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.ink,
    borderLeftWidth: 4,
    borderLeftColor: colors.gold,
    minHeight: 44,
    justifyContent: "center",
  },
  msg: { fontSize: 13, fontWeight: "700", color: colors.ink, letterSpacing: 0.2 },
  dots: { flexDirection: "row", gap: 4, marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.line },
  dotOn: { backgroundColor: colors.ink },
});
