import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CartBar } from "@/components/CartBar";
import { CartDrawer } from "@/components/CartDrawer";
import { HeaderTicker } from "@/components/HeaderTicker";
import { ItemCard } from "@/components/ItemCard";
import { LastCallBanner, lastCallExpired } from "@/components/LastCallBanner";
import { OptionsSheet } from "@/components/OptionsSheet";
import { Banner, Chip, Empty, Loading } from "@/components/ui";
import { WelcomeModal } from "@/components/WelcomeModal";
import { cartTotals, padTable, tableLabel } from "@/lib/format";
import { googleMapsUrl, trackPageview } from "@/lib/google";
import { useStore } from "@/lib/store";
import { hapticLight } from "@/lib/haptics";
import { colors } from "@/lib/theme";
import type { DietaryFilter, MenuItem } from "@/lib/types";
import { itemHasOptions } from "@/lib/modifiers";

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
  const listRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoadingCafe(true);
      void (async () => {
        await loadCafe(slug);
        if (alive) setLoadingCafe(false);
      })();
      return () => {
        alive = false;
      };
    }, [slug, loadCafe]),
  );

  useEffect(() => {
    if (!apiOnline) return;
    const id = setInterval(() => {
      void loadCafe(slug);
    }, 10_000);
    return () => clearInterval(id);
  }, [slug, apiOnline, loadCafe]);

  useEffect(() => {
    trackPageview(`/c/${slug}/t/${table}`, `${cafe.name || "Menu"}`);
  }, [slug, table, cafe.name]);

  const welcomed = guest.welcomedTables.includes(`${slug}:${table}`);
  const accent = cafe.accentColor || colors.gold;
  const totals = cartTotals(cart, items, cafe);
  const letter = (cafe.name[0] || "C").toUpperCase();
  const cur = cafe.currency || "USD";
  const sortedCats = useMemo(() => categories.slice().sort((a, b) => a.sort - b.sort), [categories]);

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
        if (itemHasOptions(item)) setSheet(item);
        else {
          void hapticLight();
          addToCart(item.id, {}, table);
        }
      }
      return;
    }
    setQty(line.lineId, line.qty + dir);
  };

  const orderingOn = cafe.orderingEnabled !== false;
  const callEnded = lastCallExpired(cafe);
  const canCheckout = orderingOn && !callEnded;
  const showWelcome = welcomeOn && !welcomed;

  if (!ready || loadingCafe || cafeSlug !== slug) return <Loading />;

  if (showWelcome) {
    return (
      <WelcomeModal
        visible
        table={`${slug}:${table}`}
        onDone={() => setWelcomeOn(false)}
      />
    );
  }

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
            style={{ marginTop: 20, minHeight: 44, justifyContent: "center" }}
          >
            <Text style={{ fontWeight: "800", letterSpacing: 1, textDecorationLine: "underline" }}>OPEN TABLE 4</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
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

      <HeaderTicker messages={cafe.headerMessages || []} accent={accent} />

      <LastCallBanner
        enabled={cafe.lastCallEnabled}
        message={cafe.lastCallMessage}
        endsAt={cafe.lastCallEndsAt}
      />

      <View style={styles.sticky}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip
            label="All"
            active={cat === "all"}
            onPress={() => {
              setCat("all");
              listRef.current?.scrollTo({ y: 0, animated: true });
            }}
          />
          {sortedCats.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              active={cat === c.id}
              onPress={() => {
                setCat(c.id);
                listRef.current?.scrollTo({ y: 0, animated: true });
              }}
            />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {(["all", "veg", "vegan", "gf"] as DietaryFilter[]).map((d) => (
            <Chip
              key={d}
              label={d === "all" ? "Diet" : d === "veg" ? "Veg" : d === "vegan" ? "Vegan" : "GF"}
              active={diet === d}
              onPress={() => setDiet(d)}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView
        ref={listRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: totals.count ? 110 : 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {!orderingOn ? (
          <View style={styles.pauseBox}>
            <Text style={styles.pauseTxt}>Ordering paused — please call staff</Text>
          </View>
        ) : null}

        {!apiOnline ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <Banner kind="err">Menu may be stale — connection issue. Orders might not reach the kitchen.</Banner>
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

        {!visible.length ? (
          <Empty title="Nothing here" body="Try another category or clear search — or ask staff to update the menu." />
        ) : null}

        <View style={styles.list}>
          {visible.map((item) => {
            const catName = categories.find((c) => c.id === item.categoryId)?.name || "";
            const q = qtyFor(item.id);
            return (
              <View key={item.id} style={styles.row}>
                <ItemCard
                  item={item}
                  categoryName={catName}
                  qty={q}
                  currency={cur}
                  onOpen={() => {
                    if (item.available !== false) setSheet(item);
                  }}
                  onAdd={() => {
                    if (item.available === false) return;
                    if (itemHasOptions(item)) setSheet(item);
                    else {
                      void hapticLight();
                      addToCart(item.id, {}, table);
                    }
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
        disabled={!canCheckout}
        disabledLabel={!orderingOn ? "Ordering paused" : "Last call ended"}
        onBag={() => setBag(true)}
        onCheckout={() => {
          if (!canCheckout) return;
          router.push({ pathname: "/checkout", params: { table, slug } } as any);
        }}
      />

      <OptionsSheet
        item={sheet}
        accent={accent}
        onClose={() => setSheet(null)}
        onAdd={(opts, qty) => {
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    minHeight: 36,
    justifyContent: "center",
  },
  tableChipTxt: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: colors.ink },
  bagBtn: {
    borderWidth: 1,
    borderColor: colors.ink,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  bagTxt: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4, color: colors.ink },
  bagBadge: { minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  bagBadgeTxt: { fontSize: 10, fontWeight: "800", color: colors.ink },
  sticky: {
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderColor: colors.ink,
    paddingTop: 10,
    zIndex: 2,
  },
  chips: { paddingHorizontal: 16, paddingBottom: 6, alignItems: "center" },
  list: { paddingHorizontal: 14, paddingTop: 4 },
  row: { marginBottom: 12 },
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
