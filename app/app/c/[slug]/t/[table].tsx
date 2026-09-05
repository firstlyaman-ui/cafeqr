import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CartBar } from "@/components/CartBar";
import { CartDrawer } from "@/components/CartDrawer";
import { ItemCard } from "@/components/ItemCard";
import { OptionsSheet } from "@/components/OptionsSheet";
import { Banner, Chip, Empty, Loading, useCols } from "@/components/ui";
import { WelcomeModal } from "@/components/WelcomeModal";
import { cartTotals, padTable, tableLabel } from "@/lib/format";
import { useStore } from "@/lib/store";
import { hapticLight } from "@/lib/haptics";
import { colors } from "@/lib/theme";
import type { DietaryFilter, MenuItem, MilkOption } from "@/lib/types";

function dietOk(item: MenuItem, filter: DietaryFilter) {
  if (filter === "all") return true;
  if (filter === "veg") return item.tags.includes("veg") || item.tags.includes("vegan");
  return item.tags.includes(filter);
}

export default function CafeTableMenu() {
  const params = useLocalSearchParams<{ slug?: string; table?: string }>();
  const slug = String(params.slug || "velvet-bean");
  const table = padTable(String(params.table || "01"));
  const store = useStore();
  const { cafe, cafeSlug, categories, items, cart, guest, ready, apiOnline, addToCart, setQty, loadCafe } = store;
  const [loadingCafe, setLoadingCafe] = useState(true);
  const [cat, setCat] = useState("all");
  const [diet, setDiet] = useState<DietaryFilter>("all");
  const [sheet, setSheet] = useState<MenuItem | null>(null);
  const [bag, setBag] = useState(false);
  const [welcomeOn, setWelcomeOn] = useState(true);
  const [search, setSearch] = useState("");
  const cols = useCols(300);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingCafe(true);
      await loadCafe(slug);
      if (alive) setLoadingCafe(false);
    })();
    return () => {
      alive = false;
    };
  }, [slug, loadCafe]);

  const welcomed = guest.welcomedTables.includes(`${slug}:${table}`);
  const accent = cafe.accentColor || colors.gold;
  const totals = cartTotals(cart, items, cafe);
  const letter = (cafe.name[0] || "C").toUpperCase();
  const cur = cafe.currency || "USD";

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (cat !== "all" && it.categoryId !== cat) return false;
      if (!dietOk(it, diet)) return false;
      if (!q) return true;
      return (
        it.name.toLowerCase().includes(q) ||
        (it.description || "").toLowerCase().includes(q)
      );
    });
  }, [items, cat, diet, search]);

  const qtyFor = (id: string) => cart.filter((l) => l.itemId === id).reduce((n, l) => n + l.qty, 0);
  const firstLine = (id: string) => cart.find((l) => l.itemId === id);

  const bump = (item: MenuItem, dir: 1 | -1) => {
    if (item.available === false) return;
    const line = firstLine(item.id);
    if (!line) {
      if (dir > 0) {
        if (item.hasMilk || item.hasExtraShot) setSheet(item);
        else { void hapticLight(); addToCart(item.id, {}, table); }
      }
      return;
    }
    setQty(line.lineId, line.qty + dir);
  };

  const orderingOn = cafe.orderingEnabled !== false;

  if (!ready || loadingCafe || cafeSlug !== slug) return <Loading />;

  const n = Number(table);
  if (!n || n < 1 || n > cafe.tableCount) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ fontWeight: "800", fontSize: 18, textAlign: "center" }}>Table not on the floor</Text>
          <Text style={{ color: colors.muted, marginTop: 8, textAlign: "center" }}>
            This cafe has {cafe.tableCount} tables. Try table 4.
          </Text>
          <Pressable
            onPress={() => router.replace(`/c/${slug}/t/04` as any)}
            style={{ marginTop: 20, minHeight: 44 }}
          >
            <Text style={{ fontWeight: "800", letterSpacing: 1, textDecorationLine: "underline" }}>OPEN TABLE 4</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.strip}>
        <Text style={styles.stripTxt}>●  CASH ONLY PAYMENT  ●  PREP TIMERS ON ORDER</Text>
        <Text style={styles.stripLink}>
          {tableLabel(table)}  ·  {cafe.cashOnly ? "CASH EXCLUSIVE" : "TABLE ORDER"}
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: totals.count ? 96 : 32 }}>
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoTxt}>{letter}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cafe}>{cafe.name.toUpperCase()}</Text>
            <Text style={styles.addr}>{(cafe.address || cafe.hours).toUpperCase()}</Text>
          </View>
          <View style={styles.tableChip}>
            <Text style={styles.tableChipTxt}>{tableLabel(table)}</Text>
          </View>
          <Pressable onPress={() => setBag(true)} style={styles.bagBtn} accessibilityLabel="Open bag">
            <Text style={styles.bagTxt}>BAG</Text>
            {totals.count > 0 ? (
              <View style={[styles.bagBadge, { backgroundColor: accent }]}>
                <Text style={styles.bagBadgeTxt}>{totals.count}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <View style={styles.sticky}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="All Items" active={cat === "all"} onPress={() => setCat("all")} />
            {categories
              .slice()
              .sort((a, b) => a.sort - b.sort)
              .map((c) => (
                <Chip key={c.id} label={c.name} active={cat === c.id} onPress={() => setCat(c.id)} />
              ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {(["all", "veg", "vegan", "gf"] as DietaryFilter[]).map((d) => (
              <Chip
                key={d}
                label={d === "all" ? "All" : d === "veg" ? "Veg" : d === "vegan" ? "Vegan" : "GF"}
                active={diet === d}
                onPress={() => setDiet(d)}
              />
            ))}
          </ScrollView>
        </View>

        {!orderingOn ? (
          <View style={styles.pauseBox}>
            <Text style={styles.pauseTxt}>Ordering paused — please call staff</Text>
          </View>
        ) : null}

        {!apiOnline ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <Banner kind="err">Menu may be stale — API offline. Orders might not reach the kitchen.</Banner>
          </View>
        ) : null}

        <View style={styles.searchWrap}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search menu…"
            placeholderTextColor={colors.faint}
            style={styles.search}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>

        <View style={styles.banner}>
          <View style={[styles.pop, { backgroundColor: accent }]}>
            <Text style={styles.popTxt}>POPULAR</Text>
          </View>
          <Text style={styles.bannerTitle}>{cafe.name.toUpperCase()} MENU</Text>
          <Text style={styles.bannerSub}>{cafe.tagline}</Text>
        </View>

        {!visible.length ? (
          <Empty title="Nothing here" body="Try another category or dietary filter — or ask staff to update the menu." />
        ) : null}

        <View style={styles.grid}>
          {visible.map((item) => {
            const catName = categories.find((c) => c.id === item.categoryId)?.name || "";
            const q = qtyFor(item.id);
            return (
              <View key={item.id} style={[styles.cell, { width: cols === 1 ? "100%" : cols === 2 ? "50%" : "33.33%" }]}>
                <ItemCard
                  item={item}
                  categoryName={catName}
                  qty={q}
                  currency={cur}
                  onOpen={() => { if (item.available !== false) setSheet(item); }}
                  onAdd={() => {
                    if (item.available === false) return;
                    if (item.hasMilk || item.hasExtraShot) setSheet(item);
                    else { void hapticLight(); addToCart(item.id, {}, table); }
                  }}
                  onInc={() => bump(item, 1)}
                  onDec={() => bump(item, -1)}
                />
              </View>
            );
          })}
        </View>
      </ScrollView>

      <CartBar
        count={totals.count}
        total={totals.total}
        wait={totals.wait}
        cash={cafe.cashOnly}
        currency={cur}
        onBag={() => setBag(true)}
        onCheckout={() => {
          if (!orderingOn) return;
          router.push({ pathname: "/checkout", params: { table, slug } } as any);
        }}
      />

      <WelcomeModal
        visible={welcomeOn && !welcomed}
        table={`${slug}:${table}`}
        onDone={() => setWelcomeOn(false)}
      />
      <OptionsSheet
        item={sheet}
        accent={accent}
        onClose={() => setSheet(null)}
        onAdd={(opts: { milk?: MilkOption; extraShot?: boolean }, qty: number) => {
          const id = sheet?.id;
          if (!id) return;
          void hapticLight();
          for (let i = 0; i < qty; i++) addToCart(id, opts, table);
          setSheet(null);
        }}
      />
      <CartDrawer open={bag} onClose={() => setBag(false)} table={table} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  strip: {
    backgroundColor: colors.ink,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  stripTxt: { color: colors.white, fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  stripLink: { color: colors.gold, fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderColor: colors.ink,
  },
  logo: { width: 40, height: 40, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  logoTxt: { color: colors.white, fontWeight: "800", fontSize: 18 },
  cafe: { fontSize: 14, fontWeight: "800", letterSpacing: 0.6, color: colors.ink },
  addr: { fontSize: 10, fontWeight: "700", letterSpacing: 1, color: colors.muted, marginTop: 3 },
  tableChip: {
    borderWidth: 1,
    borderColor: colors.ink,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: colors.white,
  },
  tableChipTxt: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: colors.ink },
  bagBtn: {
    borderWidth: 1,
    borderColor: colors.ink,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  bagTxt: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4, color: colors.ink },
  bagBadge: { minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  bagBadgeTxt: { fontSize: 10, fontWeight: "800", color: colors.ink },
  sticky: { backgroundColor: colors.bg, borderBottomWidth: 1, borderColor: colors.ink, paddingTop: 10 },
  chips: { paddingHorizontal: 16, paddingBottom: 4, alignItems: "center" },
  banner: { paddingHorizontal: 16, paddingVertical: 20, gap: 8 },
  pop: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: colors.ink },
  popTxt: { fontSize: 10, fontWeight: "800", letterSpacing: 1.6, color: colors.ink },
  bannerTitle: { fontSize: 26, fontWeight: "800", letterSpacing: 0.6, color: colors.ink },
  bannerSub: { fontSize: 14, color: colors.muted },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 10, paddingBottom: 12 },
  cell: { padding: 6 },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  search: {
    borderWidth: 1,
    borderColor: colors.ink,
    backgroundColor: colors.white,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
    minHeight: 44,
  },
  pauseBox: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.ink,
    backgroundColor: colors.goldSoft,
  },
  pauseTxt: { fontWeight: "800", color: colors.ink, letterSpacing: 0.3 },
});
