import { StyleSheet, Text, View } from "react-native";

import { Btn, Kicker } from "@/components/ui";
import { colors } from "@/lib/theme";

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Kicker>404</Kicker>
      <Text style={styles.title}>THIS PAGE IS OFF THE MENU</Text>
      <Text style={styles.body}>The table code or screen you opened doesn’t exist.</Text>
      <Btn label="Back to CafeQR" href="/" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 1,
    color: colors.ink,
    textAlign: "center",
  },
  body: { color: colors.muted, textAlign: "center", marginBottom: 8 },
});
