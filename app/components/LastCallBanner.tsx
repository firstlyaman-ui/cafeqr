import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/lib/theme";

function formatRemain(ms: number) {
  if (ms <= 0) return "0:00";
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function lastCallActive(cafe: {
  lastCallEnabled?: boolean;
  lastCallEndsAt?: number | null;
}) {
  return !!(cafe.lastCallEnabled && cafe.lastCallEndsAt && Number(cafe.lastCallEndsAt) > 0);
}

export function lastCallExpired(cafe: {
  lastCallEnabled?: boolean;
  lastCallEndsAt?: number | null;
}) {
  if (!cafe.lastCallEnabled) return false;
  const ends = cafe.lastCallEndsAt == null ? null : Number(cafe.lastCallEndsAt);
  if (!ends) return false;
  return ends <= Date.now();
}

/** Warning + countdown while last call is active. */
export function LastCallBanner({
  enabled,
  message,
  endsAt,
  compact,
}: {
  enabled?: boolean;
  message?: string;
  endsAt?: number | null;
  compact?: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!enabled || !endsAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [enabled, endsAt]);

  if (!enabled || !endsAt) return null;
  const remain = Number(endsAt) - now;
  const expired = remain <= 0;
  const copy =
    (message && message.trim()) ||
    (expired ? "Last call ended — kitchen closed for new orders" : "Last call — place orders soon");

  return (
    <View style={[styles.wrap, expired && styles.expired, compact && styles.compact]}>
      <Text style={styles.k}>{expired ? "CLOSED" : "LAST CALL"}</Text>
      <Text style={styles.msg}>{copy}</Text>
      <Text style={styles.timer}>{expired ? "0:00" : formatRemain(remain)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.ink,
    backgroundColor: "#FFF4D6",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  compact: { marginHorizontal: 0, marginTop: 0 },
  expired: { backgroundColor: "#F8E8E8" },
  k: { fontSize: 10, fontWeight: "800", letterSpacing: 1.4, color: colors.ink },
  msg: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.ink, minWidth: 120 },
  timer: { fontSize: 18, fontWeight: "800", letterSpacing: 1, color: colors.ink, fontVariant: ["tabular-nums"] },
});
