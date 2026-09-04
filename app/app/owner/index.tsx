import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { PinGate } from "@/components/PinGate";
import { Btn, Chip, Field, Loading, Screen, Toggle } from "@/components/ui";
import { tableUrlFor } from "@/lib/api";
import { money } from "@/lib/format";
import { qrDataUri } from "@/lib/qr";
import { emptyItem, useStore } from "@/lib/store";
import { colors } from "@/lib/theme";
import { OWNER_PIN, type DietaryTag, type MenuItem } from "@/lib/types";

const TAGS: DietaryTag[] = ["popular", "veg", "vegan", "gf"];

export default function Owner() {
  const params = useLocalSearchParams<{ slug?: string }>();
  const store = useStore();
  const {
    ready,
    ownerOk,
    setOwnerOk,
    cafe,
    cafeSlug,
    cafeList,
    apiOnline,
    saveCafe,
    categories,
    items,
    addCategory,
    renameCategory,
    deleteCategory,
    upsertItem,
    deleteItem,
    restoreDemo,
    loadCafe,
    refreshCafeList,
    verifyOwnerPin,
  } = store;

  const [picked, setPicked] = useState(String(params.slug || cafeSlug || "velvet-bean"));
  const [name, setName] = useState(cafe.name);
  const [tagline, setTagline] = useState(cafe.tagline);
  const [hours, setHours] = useState(cafe.hours);
  const [address, setAddress] = useState(cafe.address || "");
  const [tables, setTables] = useState(String(cafe.tableCount));
  const [cash, setCash] = useState(cafe.cashOnly);
  const [accent, setAccent] = useState(cafe.accentColor);
  const [catName, setCatName] = useState("");
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    void refreshCafeList();
  }, [refreshCafeList]);

  useEffect(() => {
    const slug = String(params.slug || picked || "velvet-bean");
    setPicked(slug);
    void loadCafe(slug);
  }, [params.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setName(cafe.name);
    setTagline(cafe.tagline);
    setHours(cafe.hours);
    setAddress(cafe.address || "");
    setTables(String(cafe.tableCount));
    setCash(cafe.cashOnly);
    setAccent(cafe.accentColor);
  }, [cafe]);

  const sortedCats = useMemo(() => categories.slice().sort((a, b) => a.sort - b.sort), [categories]);
  const cur = cafe.currency || "USD";

  if (!ready) return <Loading />;
  if (!ownerOk) {
    return (
      <PinGate
        title="Owner setup"
        hint={cafe.name || "Café console"}
        pin={OWNER_PIN}
        onCheck={(p) => verifyOwnerPin(p)}
        onOk={() => setOwnerOk(true)}
      />
    );
  }

  const switchCafe = async (slug: string) => {
    setPicked(slug);
    setOwnerOk(false);
    await loadCafe(slug);
  };

  const saveProfile = async () => {
    await saveCafe({
      name: name.trim() || cafe.name,
      tagline,
      hours,
      address,
      accentColor: accent,
      tableCount: Math.max(1, Math.min(24, parseInt(tables, 10) || 1)),
      cashOnly: cash,
    });
    setSaved(apiOnline ? "Café profile saved to API." : "Café profile saved locally (API offline).");
  };

  const startNew = () => {
    const cat = sortedCats[0]?.id || "coffee";
    setEditing(emptyItem(cat));
  };

  const saveItem = async () => {
    if (!editing) return;
    if (!editing.name.trim()) return;
    await upsertItem({
      ...editing,
      name: editing.name.trim(),
      price: Number(editing.price) || 0,
      prepMinutes: Number(editing.prepMinutes) || 5,
    });
    setEditing(null);
  };

  const printSheet = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") window.print();
  };

  const count = Math.max(1, cafe.tableCount);
  const slug = cafe.slug || cafeSlug || picked;

  return (
    <Screen maxWidth={980}>
      <View {...({ className: "no-print", dataSet: { noprint: "true" } } as any)}>
        <View style={styles.top}>
          <View>
            <Text style={styles.k}>Owner · {apiOnline ? "API" : "LOCAL"}</Text>
            <Text style={styles.h}>CAFÉ SETUP</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Btn label="Table 4 demo" href={`/c/${slug}/t/04` as any} variant="outline" />
            <Btn label="Staff board" href={`/staff?slug=${slug}` as any} variant="gold" />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Choose café</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(cafeList.length ? cafeList : [{ slug: "velvet-bean", name: cafe.name, tagline: "" }]).map((c) => (
              <Chip
                key={c.slug}
                label={c.name}
                active={slug === c.slug}
                onPress={() => void switchCafe(c.slug)}
              />
            ))}
          </View>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Slug: /c/{slug}/t/…</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Café profile</Text>
          <Field label="Café name" value={name} onChangeText={setName} />
          <Field label="Tagline" value={tagline} onChangeText={setTagline} />
          <Field label="Hours" value={hours} onChangeText={setHours} />
          <Field label="Address" value={address} onChangeText={setAddress} />
          <Text style={styles.lbl}>Logo color</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {["#C4A35A", "#E8B62C", "#111111", "#8B5E3C", "#3D5A4A", "#B85C38"].map((c) => (
              <Pressable
                key={c}
                onPress={() => setAccent(c)}
                accessibilityLabel={`Logo color ${c}`}
                style={{
                  width: 36,
                  height: 36,
                  backgroundColor: c,
                  borderWidth: accent === c ? 3 : 1.5,
                  borderColor: colors.ink,
                }}
              />
            ))}
          </View>
          <Field label="Custom hex" value={accent} onChangeText={setAccent} />
          <Field label="Tables (QR 01–N)" value={tables} onChangeText={setTables} keyboardType="number-pad" />
          <Toggle label={cash ? "Cash only · on" : "Cash only · off"} on={cash} onPress={() => setCash((v) => !v)} />
          <Btn label="Save profile" onPress={() => void saveProfile()} />
          {saved ? <Text style={styles.ok}>{saved}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Categories</Text>
          {sortedCats.map((c) => (
            <View key={c.id} style={styles.catRow}>
              <Field value={c.name} onChangeText={(v) => void renameCategory(c.id, v)} style={{ flex: 1 }} />
              <Pressable onPress={() => void deleteCategory(c.id)} style={styles.kill}>
                <Text style={styles.killTxt}>DELETE</Text>
              </Pressable>
            </View>
          ))}
          <View style={styles.catRow}>
            <View style={{ flex: 1 }}>
              <Field placeholder="New category" value={catName} onChangeText={setCatName} />
            </View>
            <Btn
              label="Add"
              onPress={() => {
                if (catName.trim()) {
                  void addCategory(catName.trim());
                  setCatName("");
                }
              }}
            />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.section}>Menu items</Text>
            <Btn label="New item" onPress={startNew} variant="gold" />
          </View>
          {sortedCats.map((c) => (
            <View key={c.id} style={{ gap: 8 }}>
              <Text style={styles.catHead}>{c.name.toUpperCase()}</Text>
              {items
                .filter((i) => i.categoryId === c.id)
                .map((it) => (
                  <Pressable key={it.id} onPress={() => setEditing({ ...it, tags: [...it.tags] })} style={styles.itemRow}>
                    <Image source={{ uri: it.image }} style={styles.thumb} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{it.name}</Text>
                      <Text style={styles.itemMeta}>
                        {money(it.price, cur)} · {it.prepMinutes} min · {it.tags.join(" · ") || "no tags"}
                      </Text>
                    </View>
                    <Text style={styles.edit}>EDIT</Text>
                  </Pressable>
                ))}
            </View>
          ))}
        </View>

        {editing ? (
          <View style={styles.card}>
            <Text style={styles.section}>{editing.name ? "Edit item" : "New item"}</Text>
            <Field label="Name" value={editing.name} onChangeText={(v) => setEditing({ ...editing, name: v })} />
            <Field
              label="Description"
              value={editing.description}
              onChangeText={(v) => setEditing({ ...editing, description: v })}
              multiline
            />
            <Field
              label="Price"
              value={String(editing.price)}
              onChangeText={(v) => setEditing({ ...editing, price: Number(v) || 0 })}
              keyboardType="decimal-pad"
            />
            <Field
              label="Prep minutes"
              value={String(editing.prepMinutes)}
              onChangeText={(v) => setEditing({ ...editing, prepMinutes: Number(v) || 0 })}
              keyboardType="number-pad"
            />
            <Field label="Photo URL" value={editing.image} onChangeText={(v) => setEditing({ ...editing, image: v })} />
            <Text style={styles.lbl}>Category</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {sortedCats.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  active={editing.categoryId === c.id}
                  onPress={() => setEditing({ ...editing, categoryId: c.id })}
                />
              ))}
            </View>
            <Text style={styles.lbl}>Tags</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {TAGS.map((t) => (
                <Toggle
                  key={t}
                  label={t}
                  on={editing.tags.includes(t)}
                  onPress={() =>
                    setEditing({
                      ...editing,
                      tags: editing.tags.includes(t) ? editing.tags.filter((x) => x !== t) : [...editing.tags, t],
                    })
                  }
                />
              ))}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              <Toggle
                label="Milk options"
                on={editing.hasMilk}
                onPress={() => setEditing({ ...editing, hasMilk: !editing.hasMilk })}
              />
              <Toggle
                label="Extra shot"
                on={editing.hasExtraShot}
                onPress={() => setEditing({ ...editing, hasExtraShot: !editing.hasExtraShot })}
              />
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <View style={{ flex: 1, minWidth: 140 }}>
                <Btn label="Save item" onPress={() => void saveItem()} variant="gold" />
              </View>
              <View style={{ flex: 1, minWidth: 140 }}>
                <Btn label="Cancel" variant="outline" onPress={() => setEditing(null)} />
              </View>
            </View>
            {items.some((i) => i.id === editing.id) ? (
              <Pressable
                onPress={() => {
                  void deleteItem(editing.id);
                  setEditing(null);
                }}
                style={{ marginTop: 8 }}
              >
                <Text style={styles.danger}>DELETE ITEM</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.rowBetween}>
          <Text style={styles.section}>Printable QR sheet</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Btn label="Print" onPress={printSheet} variant="gold" />
            <Btn label="Restore demo" variant="outline" onPress={restoreDemo} />
          </View>
        </View>
      </View>

      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>{cafe.name.toUpperCase()}</Text>
        <Text style={styles.sheetSub}>Scan the code on your table to order · cash at the counter</Text>
        <View style={styles.qrGrid}>
          {Array.from({ length: count }, (_, i) => {
            const n = i + 1;
            const url = tableUrlFor(slug, n);
            return (
              <View key={n} style={styles.qrCard}>
                <Image source={{ uri: qrDataUri(url, colors.ink) }} style={styles.qr} />
                <Text style={styles.qrTable}>TABLE {String(n).padStart(2, "0")}</Text>
                <Text style={styles.qrUrl} numberOfLines={2}>
                  {url}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" },
  k: { fontSize: 11, fontWeight: "800", letterSpacing: 2, color: colors.gold, textTransform: "uppercase" },
  h: { fontSize: 28, fontWeight: "800", letterSpacing: 0.6, color: colors.ink, marginTop: 6 },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.ink,
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  section: { fontSize: 13, fontWeight: "800", letterSpacing: 1.4, color: colors.ink, textTransform: "uppercase" },
  ok: { color: colors.ready, fontWeight: "700" },
  catRow: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  kill: { minHeight: 48, paddingHorizontal: 12, justifyContent: "center", borderWidth: 1.5, borderColor: colors.ink },
  killTxt: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: colors.danger },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 },
  catHead: { fontSize: 11, fontWeight: "800", letterSpacing: 1.6, color: colors.muted, marginTop: 8 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderColor: colors.ink,
    padding: 8,
    backgroundColor: colors.bg,
  },
  thumb: { width: 48, height: 48, backgroundColor: colors.wash },
  itemName: { fontWeight: "800", color: colors.ink },
  itemMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  edit: { fontSize: 10, fontWeight: "800", letterSpacing: 1.4, color: colors.ink },
  lbl: { fontSize: 11, letterSpacing: 1.6, fontWeight: "700", textTransform: "uppercase", color: colors.muted },
  danger: { color: colors.danger, fontWeight: "800", letterSpacing: 1.4, fontSize: 11 },
  sheet: { marginTop: 8, marginBottom: 40 },
  sheetTitle: { fontSize: 22, fontWeight: "800", letterSpacing: 1, color: colors.ink, textAlign: "center" },
  sheetSub: { textAlign: "center", color: colors.muted, marginTop: 6, marginBottom: 16 },
  qrGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center" },
  qrCard: {
    width: 200,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.white,
    padding: 12,
    alignItems: "center",
    gap: 8,
  },
  qr: { width: 160, height: 160 },
  qrTable: { fontWeight: "800", letterSpacing: 1.4, color: colors.ink },
  qrUrl: { fontSize: 10, color: colors.muted, textAlign: "center" },
});
