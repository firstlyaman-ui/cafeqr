import { Redirect, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";

import { MotionView, softFade, softFadeUp } from "@/components/motion";
import { Banner, BrandMark, Btn, Kicker, Loading, Screen } from "@/components/ui";
import {
  isCustomerApp,
  isOwnerApp,
  isStaffApp,
} from "@/lib/appRole";
import { useStore } from "@/lib/store";
import { colors, shadow } from "@/lib/theme";

const STEPS = [
  {
    n: "01",
    title: "Print table QRs",
    body: "One code per table. Tape it down. Guests scan with the camera they already have — no app to install.",
  },
  {
    n: "02",
    title: "Add your menu",
    body: "Categories, photos, prices, prep times, veg tags. Change a flat white at 2pm and every table sees it.",
  },
  {
    n: "03",
    title: "Guests order & pay cash",
    body: "Tickets land on the staff board. Cash at the counter. No card fees, no POS rebuild, no waiting on a server.",
  },
];

export default function Landing() {
  const { ready, cafeList, apiOnline, refreshCafeList } = useStore();

  useFocusEffect(
    useCallback(() => {
      void refreshCafeList();
    }, [refreshCafeList]),
  );

  // Staff/owner: never render customer demo landing (OPEN TABLE 4 / DEMO CAFÉS).
  // APP_ROLE is baked at build time; Redirect avoids a customer-UI flash on /.
  if (isStaffApp()) return <Redirect href={"/staff" as any} />;
  if (isOwnerApp()) return <Redirect href={"/owner" as any} />;

  if (!ready) return <Loading />;
  if (!isCustomerApp()) return null;

  const demo = cafeList.find((c) => c.slug === "velvet-bean") || cafeList[0];
  const demoSlug = demo?.slug || "velvet-bean";
  const demoHref = (`/c/${demoSlug}/t/04`) as any;
  const demoLabel = demo?.name ? `Try ${demo.name}` : "Try demo café";
  const tableHref = (`/c/${demoSlug}/t/04`) as any;

  return (
    <Screen maxWidth={980}>
      <MotionView entering={softFade(0)} style={styles.top}>
        <BrandMark />
        <Kicker color={colors.gold}>For independent cafés</Kicker>
      </MotionView>

      {!apiOnline ? (
        <View style={{ marginBottom: 12 }}>
          <Banner kind="err">
            API offline or unreachable — showing local demo data. Orders may not persist. Check EXPO_PUBLIC_API_URL.
          </Banner>
        </View>
      ) : null}

      <MotionView entering={softFade(80)} style={styles.hero}>
        <Text style={styles.headline}>Replace paper menus{"\n"}with table QRs.</Text>
        <Text style={styles.lede}>
          Scan a table QR, order on your phone, pay cash at the counter.
        </Text>
      </MotionView>

      <MotionView entering={softFade(160)} style={styles.ctaRow}>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Btn label={demoLabel} href={demoHref} variant="gold" pressScale />
        </View>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Btn label="Open table 4" href={tableHref} variant="outline" pressScale />
        </View>
      </MotionView>

      <View style={styles.steps}>
        {STEPS.map((s, i) => (
          <MotionView
            key={s.n}
            entering={softFadeUp(240 + i * 90)}
            style={[styles.step, shadow.card]}
          >
            <Text style={styles.num}>{s.n}</Text>
            <Text style={styles.stepTitle}>{s.title.toUpperCase()}</Text>
            <Text style={styles.stepBody}>{s.body}</Text>
          </MotionView>
        ))}
      </View>

      <MotionView entering={softFade(520)} style={styles.note}>
        <Text style={styles.noteBody}>
          Guest: /c/[slug]/t/[table] · Staff & Owner apps are separate URLs · Demo PIN 1234
        </Text>
      </MotionView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 28 },
  hero: { marginBottom: 20, gap: 10 },
  headline: {
    fontSize: 42,
    lineHeight: 48,
    fontWeight: "800",
    letterSpacing: -0.4,
    color: colors.ink,
  },
  lede: { fontSize: 17, lineHeight: 26, color: colors.muted, maxWidth: 640 },
  ctaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 28 },
  steps: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  step: {
    flexGrow: 1,
    flexBasis: 260,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.ink,
    padding: 18,
    gap: 8,
  },
  num: { fontSize: 12, fontWeight: "800", letterSpacing: 2, color: colors.gold },
  stepTitle: { fontSize: 16, fontWeight: "800", letterSpacing: 0.8, color: colors.ink },
  stepBody: { fontSize: 14, lineHeight: 21, color: colors.muted },
  note: {
    borderWidth: 1,
    borderColor: colors.ink,
    backgroundColor: colors.goldSoft,
    padding: 18,
    marginBottom: 24,
  },
  noteBody: { fontSize: 14, lineHeight: 21, color: colors.ink },
});
