import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BrandMark, Kicker } from "@/components/ui";
import { hapticError, hapticLight, hapticSuccess } from "@/lib/haptics";
import { borderWidth, colors, radius } from "@/lib/theme";

export function PinGate({
  title,
  hint,
  pin,
  onOk,
  onCheck,
}: {
  title: string;
  hint: string;
  pin: string;
  onOk: () => void;
  onCheck?: (entered: string) => boolean | Promise<boolean>;
}) {
  const [val, setVal] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  const tap = async (d: string) => {
    if (busy) return;
    void hapticLight();
    if (d === "⌫") {
      setVal((v) => v.slice(0, -1));
      setErr(false);
      return;
    }
    const next = (val + d).slice(0, 4);
    setVal(next);
    setErr(false);
    if (next.length === 4) {
      setBusy(true);
      try {
        let ok = next === pin;
        if (onCheck) ok = await onCheck(next);
        if (ok) {
          void hapticSuccess();
          onOk();
        } else {
          void hapticError();
          setErr(true);
          setVal("");
        }
      } finally {
        setBusy(false);
      }
    }
  };

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

  return (
    <View style={styles.wrap}>
      <BrandMark />
      <Kicker color={colors.gold}>{hint}</Kicker>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>DEMO PIN {pin}</Text>
      <View style={styles.dots}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.dot, i < val.length && styles.dotOn, err && styles.dotErr]} />
        ))}
      </View>
      {err ? <Text style={styles.err}>WRONG PIN</Text> : <View style={{ height: 18 }} />}
      <View style={styles.pad}>
        {keys.map((k) =>
          k === "" ? (
            <View key="pad-blank" style={styles.key} />
          ) : (
            <Pressable key={k} onPress={() => void tap(k)} style={styles.keyBtn} accessibilityLabel={k === "⌫" ? "Delete" : k}>
              <Text style={styles.keyTxt}>{k}</Text>
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    marginTop: 12,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.ink,
    textAlign: "center",
  },
  sub: {
    marginTop: 8,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "700",
    color: colors.muted,
  },
  dots: { flexDirection: "row", gap: 12, marginTop: 28 },
  dot: {
    width: 16,
    height: 16,
    borderWidth,
    borderColor: colors.ink,
    backgroundColor: colors.white,
  },
  dotOn: { backgroundColor: colors.gold },
  dotErr: { borderColor: colors.danger },
  err: { marginTop: 10, color: colors.danger, fontSize: 11, letterSpacing: 1.6, fontWeight: "800" },
  pad: {
    width: "100%",
    maxWidth: 280,
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 20,
  },
  key: { width: "33.33%", height: 64 },
  keyBtn: {
    width: "33.33%",
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderWidth,
    borderColor: colors.ink,
    backgroundColor: colors.white,
    marginTop: -1,
    marginLeft: -1,
    borderRadius: 0,
  },
  keyTxt: { fontSize: 20, fontWeight: "800", color: colors.ink },
});
