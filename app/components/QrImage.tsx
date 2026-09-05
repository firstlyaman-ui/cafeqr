import React, { useEffect, useState } from "react";
import { Image, Platform, StyleSheet, Text, View } from "react-native";

import { qrDataUriAsync } from "@/lib/qr";
import { colors } from "@/lib/theme";

export function QrImage({
  value,
  size = 160,
  color = "#111111",
  caption,
  cafeName,
}: {
  value: string;
  size?: number;
  color?: string;
  caption?: string;
  cafeName?: string;
}) {
  const [uri, setUri] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
    <View style={styles.box} {...({ className: "qr-sheet" } as any)}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, backgroundColor: "#fff" }}
          accessibilityLabel={`QR code for ${caption || value}`}
          {...({ className: "qr-img", "data-qr": "1" } as any)}
        />
      ) : (
        <View style={[styles.placeholder, { width: size, height: size }]}>
          <Text style={styles.phText}>{err ? "QR error" : "…"}</Text>
        </View>
      )}
      {caption ? <Text style={styles.cap}>{caption}</Text> : null}
      {cafeName ? <Text style={styles.cafe}>{cafeName}</Text> : null}
      <Text style={styles.url} numberOfLines={3}>
        {value}
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
  box: {
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#fff",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f3f3",
    borderWidth: 1,
    borderColor: colors.line,
  },
  phText: { color: colors.muted, fontSize: 12 },
  cap: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.ink,
  },
  cafe: { marginTop: 4, fontSize: 11, color: colors.muted, textAlign: "center" },
  url: { marginTop: 4, fontSize: 10, color: colors.muted, textAlign: "center" },
});
