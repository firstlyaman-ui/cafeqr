import React, { useMemo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { qrDataUri } from "@/lib/qr";
import { colors } from "@/lib/theme";

export function QrImage({
  value,
  size = 160,
  color = "#111111",
  caption,
}: {
  value: string;
  size?: number;
  color?: string;
  caption?: string;
}) {
  const uri = useMemo(() => qrDataUri(value, color), [value, color]);
  return (
    <View style={styles.box}>
      <Image source={{ uri }} style={{ width: size, height: size }} accessibilityLabel={`QR code for ${caption || value}`} />
      {caption ? <Text style={styles.cap}>{caption}</Text> : null}
      <Text style={styles.url} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", padding: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: "#fff" },
  cap: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.ink,
  },
  url: { marginTop: 4, fontSize: 10, color: colors.muted, textAlign: "center" },
});
