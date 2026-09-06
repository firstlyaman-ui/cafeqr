import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Banner, BrandMark, Btn, Kicker, Loading, Screen } from "@/components/ui";
import {
  APP_ROLE,
  isCustomerApp,
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

  if (!ready) return <Loading />;

  // Staff/owner builds redirect via RoleGuard; keep a tiny fallback.
  if (!isCustomerApp()) {
    return (
      <Screen maxWidth={560}>
        <Text style={styles.headline}>{APP_ROLE} app</Text>
        <Text style={styles.lede}>Loading…</Text>
      </Screen>
    );
  }

  const demo = cafeList.find((c) => c.slug === "velvet-bean") || cafeList[0];
  const demoHref = (`/c/${demo?.slug || "velvet-bean"}/t/04`) as any;
  const demoLabel = demo?.name ? `Try ${demo.name}` : "Try demo café";

  return (
    <Screen maxWidth={980}>
      <View style={styles.top}>
        <BrandMark />
        <Kicker color={colors.gold}>For independent cafés</Kicker>
      </View>

      {!apiOnline ? (
        <View style={{ marginBottom: 12 }}>
          <Banner kind="err">
            API offline or unreachable — showing local demo data. Orders may not persist. Check EXPO_PUBLIC_API_URL.
          </Banner>
        </View>
      ) : null}

      <View style={styles.hero}>
        <Text style={styles.headline}>Replace paper menus{"\n"}with table QRs.</Text>
        <Text style={styles.lede}>
          Scan a table QR, order on your phone, pay cash at the counter.
        </Text>
      </View>

      <View style={styles.ctaRow}>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Btn label={demoLabel} href={demoHref} variant="gold" />
        </View>
      </View>

      <View style={styles.cafeBlock}>
        <Text style={styles.cafeHead}>DEMO CAFÉS{apiOnline ? "" : " · OFFLINE"}</Text>
        <View style={styles.cafeGrid}>
          {(cafeList.length
            ? cafeList
            : [{ slug: "velvet-bean", name: "Demo café", tagline: "Demo", currency: "USD" }]
          ).map((c) => (
            <View key={c.slug} style={[styles.cafeCard, shadow.card]}>
              <Text style={styles.cafeName}>{c.name}</Text>
              <Text style={styles.cafeTag}>{c.tagline}</Text>
              <Text style={styles.cafeSlug}>
                /c/{c.slug}/t/04 {c.currency ? `· ${c.currency}` : ""}
              </Text>
              <Btn label="Open table 4" href={`/c/${c.slug}/t/04` as any} variant="gold" />
            </View>
          ))}
        </View>
      </View>

      <View style={styles.steps}>
        {STEPS.map((s) => (
          <View key={s.n} style={[styles.step, shadow.card]}>
            <Text style={styles.num}>{s.n}</Text>
            <Text style={styles.stepTitle}>{s.title.toUpperCase()}</Text>
            <Text style={styles.stepBody}>{s.body}</Text>
          </View>
        ))}
      </View>

      <View style={styles.note}>
        <Text style={styles.noteBody}>
          Guest: /c/[slug]/t/[table] · Staff & Owner apps are separate URLs · Demo PIN 1234
        </Text>
      </View>
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
  ctaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  roleHint: { fontSize: 13, color: colors.muted, marginBottom: 28, lineHeight: 18 },
  cafeBlock: { marginBottom: 20, gap: 10, marginTop: 20 },
  cafeHead: { fontSize: 11, fontWeight: "800", letterSpacing: 1.8, color: colors.ink },
  cafeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cafeCard: {
    flexGrow: 1,
    flexBasis: 280,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.ink,
    padding: 16,
    gap: 10,
  },
  cafeName: { fontSize: 18, fontWeight: "800", color: colors.ink },
  cafeTag: { fontSize: 14, color: colors.muted },
  cafeSlug: { fontSize: 12, fontWeight: "700", color: colors.gold, letterSpacing: 0.4 },
  extNote: { fontSize: 11, color: colors.muted },
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
  noteK: { fontSize: 11, fontWeight: "800", letterSpacing: 1.8, textTransform: "uppercase", color: colors.ink, marginBottom: 8 },
  noteBody: { fontSize: 14, lineHeight: 21, color: colors.ink },
});
