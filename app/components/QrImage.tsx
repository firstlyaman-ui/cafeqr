import React, { useEffect, useState } from "react";
import { Image, Platform, StyleSheet, Text, View } from "react-native";

import { qrDataUriAsync } from "@/lib/qr";
import { colors } from "@/lib/theme";

/** Restaurant-style table-tent QR card for print sheets. */
export function QrImage({
  value,
  size = 140,
  color = "#111111",
  caption,
  cafeName,
  accentColor,
  cashOnly = true,
}: {
  value: string;
  size?: number;
  color?: string;
  caption?: string;
  cafeName?: string;
  accentColor?: string;
  cashOnly?: boolean;
}) {
  const [uri, setUri] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const accent = accentColor || colors.gold;
  const shortUrl = value.replace(/^https?:\/\//, "");

  useEffect(() => {
    let cancelled = false;
    setUri(null);
    setErr(null);
    void qrDataUriAsync(value, { color, width: Math.max(160, size * 2) })
      .then((next) => {
        if (!cancelled) setUri(next);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : "QR failed");
      });
    return () => {
      cancelled = true;
    };
  }, [value, color, size]);

  return (
    <View style={[styles.card, { borderColor: colors.ink }]} {...({ className: "qr-sheet" } as any)}>
      <View style={[styles.bar, { backgroundColor: accent }]} />
      {cafeName ? <Text style={styles.cafe}>{cafeName.toUpperCase()}</Text> : null}
      <Text style={styles.scan}>Scan to order</Text>
      {caption ? <Text style={styles.table}>{caption}</Text> : null}
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, backgroundColor: "#fff", marginVertical: 8 }}
          accessibilityLabel={`QR code for ${caption || value}`}
          {...({ className: "qr-img", "data-qr": "1" } as any)}
        />
      ) : (
        <View style={[styles.placeholder, { width: size, height: size }]}>
          <Text style={styles.phText}>{err ? "QR error" : "…"}</Text>
        </View>
      )}
      {cashOnly ? (
        <View style={[styles.chip, { backgroundColor: accent }]}>
          <Text style={styles.chipTxt}>CASH ONLY</Text>
        </View>
      ) : null}
      <Text style={styles.url} numberOfLines={2}>
        {shortUrl}
      </Text>
    </View>
  );
}

/** Wait for QR <img> nodes to finish loading, then print (web only). */
export async function printQrSheet() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  const root = typeof document !== "undefined" ? document : null;
  if (root) {
    const imgs = Array.from(root.querySelectorAll(".qr-print-cell img, .qr-sheet img, img.qr-img")) as HTMLImageElement[];
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth > 0) {
              resolve();
              return;
            }
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
            setTimeout(done, 2500);
          }),
      ),
    );
  }
  window.print();
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    paddingBottom: 12,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    backgroundColor: "#fff",
    width: "100%",
    overflow: "hidden",
  },
  bar: { height: 8, width: "100%", marginBottom: 10, alignSelf: "stretch" },
  cafe: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: colors.ink,
    textAlign: "center",
  },
  scan: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.muted,
  },
  table: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.ink,
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f3f3",
    borderWidth: 1,
    borderColor: colors.line,
    marginVertical: 8,
  },
  phText: { color: colors.muted, fontSize: 12 },
  chip: {
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.ink,
  },
  chipTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 1.2, color: colors.ink },
  url: { marginTop: 6, fontSize: 9, color: colors.muted, textAlign: "center", paddingHorizontal: 4 },
});
