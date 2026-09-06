import { Redirect, usePathname, useSegments } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  APP_ROLE,
  CUSTOMER_URL,
  OWNER_URL,
  STAFF_URL,
  openExternal,
  pathAllowedForRole,
  roleHomePath,
} from "@/lib/appRole";
import { colors } from "@/lib/theme";
import { Btn } from "./ui";

/**
 * Layout-level isolation: redirect home for role, and block forbidden paths.
 * Metro blockList also omits other-role screens from the bundle.
 */
export function RoleGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const segments = useSegments();

  if (APP_ROLE === "staff" && (pathname === "/" || pathname === "")) {
    return <Redirect href={"/staff" as any} />;
  }
  if (APP_ROLE === "owner" && (pathname === "/" || pathname === "")) {
    return <Redirect href={"/owner" as any} />;
  }

  const path = pathname || "/" + (segments || []).join("/");
  const allowed = pathAllowedForRole(path);

  if (!allowed) {
    const other =
      path.startsWith("/staff") || path === "/staff"
        ? { label: "Open staff app", url: STAFF_URL }
        : path.startsWith("/owner") || path === "/owner"
          ? { label: "Open owner app", url: OWNER_URL }
          : { label: "Open guest menu", url: CUSTOMER_URL };

    return (
      <View style={styles.wrap}>
        <Text style={styles.k}>{APP_ROLE.toUpperCase()} APP</Text>
        <Text style={styles.h}>Wrong app for this page</Text>
        <Text style={styles.body}>
          This build only serves {APP_ROLE} flows. Use the matching CafeQR app URL instead.
        </Text>
        <View style={{ gap: 10, marginTop: 16, width: "100%", maxWidth: 360 }}>
          <Btn label={other.label} onPress={() => openExternal(other.url)} variant="gold" />
          <Btn label="Go to home" href={roleHomePath() as any} variant="outline" />
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  k: { fontSize: 11, fontWeight: "800", letterSpacing: 2, color: colors.gold },
  h: { fontSize: 26, fontWeight: "800", color: colors.ink, marginTop: 10, textAlign: "center" },
  body: { fontSize: 15, lineHeight: 22, color: colors.muted, marginTop: 10, textAlign: "center", maxWidth: 420 },
});
