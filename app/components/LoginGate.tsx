import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { BrandMark, Btn, Kicker } from "@/components/ui";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { borderWidth, colors, radius, shadow } from "@/lib/theme";

export function LoginGate({
  role,
  title,
  onLogin,
}: {
  role: "staff" | "owner";
  title: string;
  onLogin: (input: {
    userId: string;
    password: string;
    pin: string;
  }) => Promise<{ ok: true; slug: string; cafeName: string } | { ok: false; error: string }>;
}) {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setErr(null);
    const u = userId.trim();
    const p = password;
    const code = pin.trim();
    if (!u || !p || code.length < 4) {
      setErr("Enter Cafe User ID, password, and 4-digit PIN");
      void hapticError();
      return;
    }
    setBusy(true);
    try {
      const r = await onLogin({ userId: u, password: p, pin: code });
      if (r.ok) {
        void hapticSuccess();
      } else {
        void hapticError();
        setErr(r.error || "Login failed");
        setPin("");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.card, shadow.hard]}>
        <BrandMark />
        <Kicker color={colors.gold}>{role === "owner" ? "Owner app" : "Staff app"}</Kicker>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.hint}>Demo: cafe1 / cafe2 / cafe3 · pass · 1234</Text>

        <Text style={styles.lbl}>Cafe User ID</Text>
        <TextInput
          value={userId}
          onChangeText={setUserId}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="e.g. cafe1"
          placeholderTextColor={colors.faint}
          style={styles.input}
          accessibilityLabel="Cafe User ID"
        />

        <Text style={styles.lbl}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Password"
          placeholderTextColor={colors.faint}
          style={styles.input}
          accessibilityLabel="Password"
        />

        <Text style={styles.lbl}>PIN</Text>
        <TextInput
          value={pin}
          onChangeText={(v) => setPin(v.replace(/\D/g, "").slice(0, 8))}
          keyboardType="number-pad"
          secureTextEntry
          placeholder="4-digit PIN"
          placeholderTextColor={colors.faint}
          style={styles.input}
          accessibilityLabel="PIN"
          onSubmitEditing={() => void submit()}
        />

        {err ? <Text style={styles.err}>{err}</Text> : <View style={{ height: 18 }} />}

        <Btn label={busy ? "Signing in…" : "Sign in"} onPress={() => void submit()} disabled={busy} variant="gold" />
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
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.white,
    borderWidth,
    borderColor: colors.ink,
    borderRadius: radius,
    padding: 24,
    gap: 6,
  },
  title: {
    marginTop: 10,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 0.4,
    color: colors.ink,
  },
  hint: { color: colors.muted, fontSize: 13, marginBottom: 10, marginTop: 4 },
  lbl: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.muted,
  },
  input: {
    borderWidth,
    borderColor: colors.ink,
    backgroundColor: colors.bg,
    minHeight: 48,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: "600",
    color: colors.ink,
  },
  err: { color: colors.danger, fontWeight: "700", marginVertical: 8 },
});
