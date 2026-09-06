import React, { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LastCallBanner } from "@/components/LastCallBanner";
import { Btn } from "@/components/ui";
import { staffBoardUrl, openExternal } from "@/lib/appRole";
import { GOOGLE_CLIENT_ID, googleMapsUrl, signInWithGoogle } from "@/lib/google";
import { useStore } from "@/lib/store";
import { colors, shadow, type } from "@/lib/theme";

/** Full-screen welcome / login — shown before the menu on first visit to a table. */
export function WelcomeModal({
  visible,
  table,
  onDone,
}: {
  visible: boolean;
  table: string;
  onDone: () => void;
}) {
  const { cafe, setGuest, markWelcomed } = useStore();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const accent = cafe.accentColor || colors.gold;

  if (!visible) return null;

  const finish = (withPhone: boolean, name?: string) => {
    const next: { phone?: string; name?: string } = {};
    if (withPhone && phone.trim()) next.phone = phone.trim();
    if (name) next.name = name;
    if (Object.keys(next).length) setGuest(next);
    markWelcomed(table);
    onDone();
  };

  const onGoogle = async () => {
    setErr(null);
    setBusy(true);
    try {
      const r = await signInWithGoogle();
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      setGuest({ name: r.name, phone: phone.trim() || r.email || "" });
      markWelcomed(table);
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={[styles.accent, { backgroundColor: accent }]} />
      <View style={styles.inner}>
        <View style={[styles.card, shadow.hard]}>
          <View style={[styles.icon, { backgroundColor: colors.ink }]}>
            <View style={[styles.head, { backgroundColor: accent }]} />
            <View style={[styles.body, { borderColor: accent }]} />
          </View>
          <Text style={[type.kicker, { color: colors.muted, marginTop: 18, textAlign: "center" }]}>Welcome to</Text>
          <Text style={styles.cafe}>{cafe.name.toUpperCase()}</Text>
          {cafe.address ? (
            <Pressable
              onPress={() => void Linking.openURL(googleMapsUrl(cafe.address))}
              style={{ marginTop: 8, minHeight: 44, justifyContent: "center" }}
              accessibilityRole="link"
              accessibilityLabel="Open address in Google Maps"
            >
              <Text style={styles.maps}>{cafe.address} · Maps</Text>
            </Pressable>
          ) : null}
          <Text style={[type.kicker, { color: colors.faint, marginTop: 10, textAlign: "center" }]}>
            Sign in or continue as guest
          </Text>

          {cafe.lastCallEnabled ? (
            <View style={{ marginTop: 14 }}>
              <LastCallBanner
                enabled={cafe.lastCallEnabled}
                message={cafe.lastCallMessage}
                endsAt={cafe.lastCallEndsAt}
                compact
              />
            </View>
          ) : null}

          <View style={styles.phoneRow}>
            <Text style={styles.phoneIcon}>☎</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Mobile Number"
              placeholderTextColor={colors.faint}
              keyboardType="phone-pad"
              style={styles.phoneInput}
              accessibilityLabel="Mobile number"
            />
          </View>

          <Btn
            label={busy ? "Connecting…" : "Continue with Google"}
            variant="gray"
            accent={accent}
            disabled={busy}
            onPress={() => void onGoogle()}
          />
          {!GOOGLE_CLIENT_ID ? (
            <Text style={styles.hint}>Google Sign-In activates when EXPO_PUBLIC_GOOGLE_CLIENT_ID is set.</Text>
          ) : null}
          {err ? <Text style={styles.err}>{err}</Text> : null}

          <Btn label="Login with phone  →" variant="outline" onPress={() => finish(true)} />

          <View style={styles.orRow}>
            <View style={styles.dash} />
            <Text style={styles.or}>OR</Text>
            <View style={styles.dash} />
          </View>

          <Btn label="Continue as Guest" variant="outline" onPress={() => finish(false)} />

          <Pressable
            onPress={() => {
              markWelcomed(table);
              openExternal(staffBoardUrl(cafe.slug));
            }}
            accessibilityRole="link"
            accessibilityLabel="Staff access"
            style={{ marginTop: 18, minHeight: 44, justifyContent: "center" }}
          >
            <Text style={styles.staff}>STAFF ACCESS</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  accent: { height: 6, width: "100%" },
  inner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.white,
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: colors.ink,
  },
  icon: {
    width: 40,
    height: 40,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  head: { width: 10, height: 10 },
  body: { width: 16, height: 8, borderWidth: 2, borderBottomWidth: 0 },
  cafe: {
    marginTop: 8,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: 0.8,
    textAlign: "center",
    color: colors.ink,
  },
  maps: {
    textAlign: "center",
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.ink,
    minHeight: 48,
    paddingHorizontal: 12,
    marginTop: 22,
    marginBottom: 12,
    backgroundColor: colors.white,
  },
  phoneIcon: { fontSize: 14, marginRight: 8, color: colors.muted },
  phoneInput: { flex: 1, fontSize: 16, color: colors.ink, minHeight: 48 },
  hint: { color: colors.faint, fontSize: 11, marginTop: 8, marginBottom: 4, textAlign: "center" },
  err: { color: "#B00020", fontSize: 12, fontWeight: "700", marginTop: 8, marginBottom: 4, textAlign: "center" },
  orRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 14 },
  dash: { flex: 1, height: 1, borderBottomWidth: 1, borderStyle: "dashed", borderColor: colors.ink },
  or: { fontSize: 11, letterSpacing: 2, color: colors.faint, fontWeight: "700" },
  staff: {
    textAlign: "center",
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.faint,
    textDecorationLine: "underline",
    fontWeight: "700",
  },
});
