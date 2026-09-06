import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { RoleGuard } from "@/components/RoleGuard";
import { APP_ROLE } from "@/lib/appRole";
import { StoreProvider } from "@/lib/store";
import { colors } from "@/lib/theme";

export const unstable_settings = {
  initialRouteName: APP_ROLE === "staff" ? "staff/index" : APP_ROLE === "owner" ? "owner/index" : "index",
};

export default function RootLayout() {
  return (
    <StoreProvider>
      <StatusBar style="dark" />
      <RoleGuard>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: "fade",
          }}
        />
      </RoleGuard>
    </StoreProvider>
  );
}
