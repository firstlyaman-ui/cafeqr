import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { QrImage, printQrSheet } from "@/components/QrImage";
import { Btn, Screen } from "@/components/ui";
import { tableUrlFor } from "@/lib/api";
import { padTable, tableLabel } from "@/lib/format";
import { useStore } from "@/lib/store";
import { colors, type } from "@/lib/theme";

export default function StaffQr() {
  const { cafe, cafeSlug, loadCafe } = useStore();
  const slug = cafe.slug || cafeSlug || "velvet-bean";

  useFocusEffect(
    useCallback(() => {
      void loadCafe(slug);
    }, [loadCafe, slug]),
  );
  const tables = useMemo(
    () => Array.from({ length: cafe.tableCount }, (_, i) => padTable(String(i + 1))),
    [cafe.tableCount],
  );

  return (
    <Screen maxWidth={980}>
      <View {...({ className: "no-print", dataSet: { noprint: "true" } } as any)}>
        <Text style={[type.kicker, { color: colors.muted }]}>Print and stick</Text>
        <Text style={[type.title, { marginTop: 8 }]}>Table QR sheet</Text>
        <Text style={[type.body, { color: colors.muted, marginTop: 8 }]}>
          {cafe.tableCount} table tent cards · /c/{slug}/t/NN · Print and place one per table.
        </Text>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 16, marginBottom: 20, flexWrap: "wrap" }}>
          <Btn label="Print sheet" onPress={() => void printQrSheet()} />
          <Btn label="Kitchen board" href={`/staff?slug=${slug}` as any} variant="outline" />
        </View>
      </View>
      <View style={styles.grid} {...({ className: "qr-print-grid qr-print-sheet" } as any)}>
        {tables.map((t) => (
          <View key={t} style={styles.cell} {...({ className: "qr-print-cell" } as any)}>
            <QrImage
              value={tableUrlFor(slug, t)}
              caption={tableLabel(t)}
              cafeName={cafe.name}
              accentColor={cafe.accentColor}
              cashOnly={cafe.cashOnly !== false}
              size={132}
            />
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center" },
  cell: { width: 210, alignItems: "stretch", marginBottom: 8 },
});
