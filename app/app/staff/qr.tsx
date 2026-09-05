import React, { useMemo } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { QrImage } from "@/components/QrImage";
import { Btn, Screen } from "@/components/ui";
import { tableUrlFor } from "@/lib/api";
import { padTable, tableLabel } from "@/lib/format";
import { useStore } from "@/lib/store";
import { colors, type } from "@/lib/theme";

export default function StaffQr() {
  const { cafe, cafeSlug } = useStore();
  const slug = cafe.slug || cafeSlug || "velvet-bean";
  const tables = useMemo(
    () => Array.from({ length: cafe.tableCount }, (_, i) => padTable(String(i + 1))),
    [cafe.tableCount],
  );

  const print = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") window.print();
  };

  return (
    <Screen maxWidth={980}>
      <View {...({ className: "no-print", dataSet: { noprint: "true" } } as any)}>
        <Text style={[type.kicker, { color: colors.muted }]}>Print and stick</Text>
        <Text style={[type.title, { marginTop: 8 }]}>Table QR sheet</Text>
        <Text style={[type.body, { color: colors.muted, marginTop: 8 }]}>
          {cafe.name} · {cafe.tableCount} tables · paths /c/{slug}/t/NN. Tape one per seat. Guests scan and order. On
          web, use print — chrome hides and QRs fit one page.
        </Text>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 16, marginBottom: 20, flexWrap: "wrap" }}>
          <Btn label="Print sheet" onPress={print} />
          <Btn label="Kitchen board" href={`/staff?slug=${slug}` as any} variant="outline" />
        </View>
      </View>
      <View style={styles.grid} {...({ className: "qr-print-grid" } as any)}>
        {tables.map((t) => (
          <View key={t} style={styles.cell} {...({ className: "qr-print-cell" } as any)}>
            <QrImage value={tableUrlFor(slug, t)} caption={tableLabel(t)} size={140} />
            <Text style={styles.cafe}>{cafe.name}</Text>
            <Text style={styles.path}>
              /c/{slug}/t/{t}
            </Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center" },
  cell: { width: 200, alignItems: "center", marginBottom: 8 },
  cafe: { marginTop: 6, fontSize: 11, color: colors.muted, textAlign: "center" },
  path: { fontSize: 10, color: colors.gold, textAlign: "center", marginTop: 2 },
});
