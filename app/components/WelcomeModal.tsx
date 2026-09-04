import { router } from "expo-router";
import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Btn } from "@/components/ui";
import { useStore } from "@/lib/store";
import { colors, shadow, type } from "@/lib/theme";

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
  const accent = cafe.accentColor || colors.gold;

  const finish = (withPhone: boolean) => {
    if (withPhone && phone.trim()) setGuest({ phone: phone.trim() });
    markWelcomed(table);
    onDone();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => finish(false)}>
      <View style={styles.backdrop}>
        <View style={[styles.card, shadow.hard]}>
          <View style={[styles.icon, { backgroundColor: colors.ink }]}>
            <View style={[styles.head, { backgroundColor: accent }]} />
            <View style={[styles.body, { borderColor: accent }]} />
          </View>
          <Text style={[type.kicker, { color: colors.muted, marginTop: 18, textAlign: "center" }]}>Welcome to</Text>
          <Text style={styles.cafe}>{cafe.name.toUpperCase()}</Text>
          <Text style={[type.kicker, { color: colors.faint, marginTop: 10, textAlign: "center" }]}>
            Log in to earn loyalty points
          </Text>

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
            label="Login for rewards  →"
            variant="gray"
            accent={accent}
            onPress={() => finish(true)}
          />

          <View style={styles.orRow}>
            <View style={styles.dash} />
            <Text style={styles.or}>OR</Text>
            <View style={styles.dash} />
          </View>

          <Btn label="Continue as guest" variant="outline" onPress={() => finish(false)} />

          <Pressable
            onPress={() => {
              markWelcomed(table);
              router.push("/staff");
            }}
            accessibilityRole="link"
            accessibilityLabel="Staff access"
            style={{ marginTop: 18, minHeight: 44, justifyContent: "center" }}
          >
            <Text style={styles.staff}>STAFF ACCESS</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(245,244,240,0.78)",
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
    borderWidth: 1.5,
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
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.ink,
    minHeight: 48,
    paddingHorizontal: 12,
    marginTop: 22,
    marginBottom: 12,
    backgroundColor: colors.white,
  },
  phoneIcon: { fontSize: 14, marginRight: 8, color: colors.muted },
  phoneInput: { flex: 1, fontSize: 16, color: colors.ink, minHeight: 48 },
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
