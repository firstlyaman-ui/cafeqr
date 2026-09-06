import { useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { LoginGate } from "@/components/LoginGate";
import { QrImage, printQrSheet } from "@/components/QrImage";
import { Banner, Btn, Chip, Field, Loading, Screen, Toggle } from "@/components/ui";
import { tableUrlFor } from "@/lib/api";
import { isHttpUrl, money, parseIntInput, parseMoneyInput } from "@/lib/format";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { customerTableUrl, openExternal, staffBoardUrl } from "@/lib/appRole";
import { emptyItem, useStore } from "@/lib/store";
import { borderWidth, colors, radius, shadow } from "@/lib/theme";
import { COUNTRY_TAX_DEFAULTS, type CountryCode, type DietaryTag, type MenuItem, type ModifierGroup } from "@/lib/types";
import {
  defaultExtraShotGroup,
  defaultMilkGroup,
  nidShort,
  parseModifiers,
} from "@/lib/modifiers";

const TAGS: DietaryTag[] = ["popular", "veg", "vegan", "gf"];
const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80";

type Draft = MenuItem & { priceStr: string; prepStr: string };

function toDraft(item: MenuItem): Draft {
  return {
    ...item,
    tags: [...item.tags],
    modifiers: parseModifiers(item.modifiers),
    priceStr: Number.isFinite(item.price) ? String(item.price) : "",
    prepStr: Number.isFinite(item.prepMinutes) ? String(item.prepMinutes) : "5",
  };
}


function syncFlagsFromModifiers(mods: ModifierGroup[]): { hasMilk: boolean; hasExtraShot: boolean } {
  return {
    hasMilk: mods.some((g) => g.id === "milk" || /milk/i.test(g.name)),
    hasExtraShot: mods.some((g) => g.id === "extra-shot" || /extra\s*shot/i.test(g.name)),
  };
}

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
    loginWithCredentials,
    saveCafeCredentials,
    loadCafeCredentials,
  } = store;

  const [picked, setPicked] = useState(String(params.slug || cafeSlug || "velvet-bean"));
  const [name, setName] = useState(cafe.name);
  const [tagline, setTagline] = useState(cafe.tagline);
  const [hours, setHours] = useState(cafe.hours);
  const [address, setAddress] = useState(cafe.address || "");
  const [tables, setTables] = useState(String(cafe.tableCount));
  const [cash, setCash] = useState(cafe.cashOnly);
  const [orderingOn, setOrderingOn] = useState(cafe.orderingEnabled !== false);
  const [country, setCountry] = useState((cafe.country || "US").toUpperCase());
  const [currency, setCurrency] = useState(cafe.currency || "USD");
  const [taxName, setTaxName] = useState(cafe.taxName || "Tax");
  const [taxPct, setTaxPct] = useState(
    String(Math.round((Number(cafe.taxRate) || 0.08) * 10000) / 100),
  );
  const [accent, setAccent] = useState(cafe.accentColor);
  const [catName, setCatName] = useState("");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [flash, setFlash] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);
  const [credOwnerUser, setCredOwnerUser] = useState("");
  const [credStaffUser, setCredStaffUser] = useState("");
  const [credOwnerPass, setCredOwnerPass] = useState("");
  const [credStaffPass, setCredStaffPass] = useState("");
  const [credOwnerPin, setCredOwnerPin] = useState("");
  const [credStaffPin, setCredStaffPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [catDrafts, setCatDrafts] = useState<Record<string, string>>({});

  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashMsg = (kind: "ok" | "err" | "info", text: string) => {
    setFlash({ kind, text });
    if (kind === "ok") void hapticSuccess();
    if (kind === "err") void hapticError();
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), kind === "err" ? 6000 : 3200);
  };

  useFocusEffect(
    useCallback(() => {
      void refreshCafeList();
    }, [refreshCafeList]),
  );

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
    setOrderingOn(cafe.orderingEnabled !== false);
    setCountry((cafe.country || "US").toUpperCase());
    setCurrency(cafe.currency || "USD");
    setTaxName(cafe.taxName || "Tax");
    setTaxPct(String(Math.round((Number(cafe.taxRate) || 0.08) * 10000) / 100));
    setAccent(cafe.accentColor);
  }, [cafe]);

  useEffect(() => {
    setCatDrafts((prev) => {
      const next: Record<string, string> = {};
      for (const c of categories) {
        next[c.id] = prev[c.id] !== undefined && prev[c.id] !== c.name ? prev[c.id] : c.name;
      }
      return next;
    });
  }, [categories]);

  const sortedCats = useMemo(() => categories.slice().sort((a, b) => a.sort - b.sort), [categories]);
  const cur = cafe.currency || "USD";
  const orphanItems = useMemo(
    () => items.filter((i) => !categories.some((c) => c.id === i.categoryId)),
    [items, categories],
  );

  if (!ready) return <Loading />;
  if (!ownerOk) {
    return (
      <LoginGate
        role="owner"
        title="Owner sign in"
        onLogin={async (input) => {
          const r = await loginWithCredentials({ role: "owner", ...input });
          if (r.ok) {
            setPicked(r.slug);
            void hapticSuccess();
          } else {
            void hapticError();
          }
          return r;
        }}
      />
    );
  }

  const switchCafe = async (slug: string) => {
    setPicked(slug);
    setOwnerOk(false);
    setEditing(null);
    setFlash(null);
    await loadCafe(slug);
  };

  const saveProfile = async () => {
    setBusy(true);
    try {
      const pct = parseMoneyInput(taxPct);
      const rate = Math.min(1, Math.max(0, pct / 100));
      const r = await saveCafe({
        name: name.trim() || cafe.name,
        tagline,
        hours,
        address,
        accentColor: accent,
        tableCount: Math.max(1, Math.min(24, parseIntInput(tables, 1) || 1)),
        cashOnly: cash,
        orderingEnabled: orderingOn,
        country: country.trim().toUpperCase() || "US",
        currency: (currency.trim().toUpperCase() || "USD") as any,
        taxName: taxName.trim() || "Tax",
        taxRate: rate,
      });
      if (r.ok) {
        // Name/profile already in store + cafeList; refresh list again for other tabs/sessions
        void refreshCafeList();
        flashMsg("ok", apiOnline ? "Café profile saved." : "Saved locally (API offline).");
      } else flashMsg("err", r.error);
    } finally {
      setBusy(false);
    }
  };

  const startNew = () => {
    const cat = sortedCats[0]?.id;
    if (!cat) {
      flashMsg("err", "Add a category before creating items.");
      return;
    }
    setFormErr("");
    setEditing(toDraft(emptyItem(cat)));
  };

  const saveItem = async () => {
    if (!editing) return;
    const trimmed = editing.name.trim();
    if (!trimmed) {
      setFormErr("Name is required.");
      void hapticError();
      return;
    }
    if (!editing.categoryId) {
      setFormErr("Pick a category.");
      void hapticError();
      return;
    }
    const price = parseMoneyInput(editing.priceStr);
    const prep = parseIntInput(editing.prepStr, 5) || 5;
    const image = (editing.image || "").trim() || DEFAULT_IMAGE;
    if (editing.image.trim() && editing.image.trim().length > 2048) {
      Alert.alert("Image URL too long", "Keep image URLs under 2048 characters.");
      return;
    }
    if (editing.image.trim() && !isHttpUrl(image)) {
      setFormErr("Photo URL must start with http:// or https://");
      void hapticError();
      return;
    }
    setBusy(true);
    setFormErr("");
    try {
      const r = await upsertItem({
        ...editing,
        name: trimmed,
        price,
        prepMinutes: prep,
        image,
      });
      if (r.ok) {
        setEditing(null);
        flashMsg("ok", "Item saved.");
      } else {
        setFormErr(r.error);
        flashMsg("err", r.error);
      }
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteCategory = (id: string, label: string) => {
    const count = items.filter((i) => i.categoryId === id).length;
    const msg = count
      ? `Delete “${label}” and its ${count} item${count === 1 ? "" : "s"}? This cannot be undone.`
      : `Delete category “${label}”?`;
    const run = async () => {
      setBusy(true);
      try {
        const r = await deleteCategory(id);
        if (r.ok) flashMsg("ok", "Category deleted.");
        else flashMsg("err", r.error);
      } finally {
        setBusy(false);
      }
    };
    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (window.confirm(msg)) void run();
    } else {
      Alert.alert("Delete category", msg, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => void run() },
      ]);
    }
  };

  const confirmDeleteItem = () => {
    if (!editing) return;
    const msg = `Delete “${editing.name || "this item"}”?`;
    const run = async () => {
      setBusy(true);
      try {
        const r = await deleteItem(editing.id);
        if (r.ok) {
          setEditing(null);
          flashMsg("ok", "Item deleted.");
        } else flashMsg("err", r.error);
      } finally {
        setBusy(false);
      }
    };
    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (window.confirm(msg)) void run();
    } else {
      Alert.alert("Delete item", msg, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => void run() },
      ]);
    }
  };

  const printSheet = () => {
    void printQrSheet();
  };

  const count = Math.max(1, cafe.tableCount);
  const slug = cafe.slug || cafeSlug || picked;

  return (
    <Screen maxWidth={980}>
      <View {...({ className: "no-print", dataSet: { noprint: "true" } } as any)}>
        <View style={styles.top}>
          <View>
            <Text style={styles.k}>Owner · {apiOnline ? "Live API" : "Offline"}</Text>
            <Text style={styles.h}>Café setup</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Btn label="Open guest menu" onPress={() => openExternal(customerTableUrl(slug, "04"))} variant="outline" />
            <Btn label="Staff app" onPress={() => openExternal(staffBoardUrl(slug))} variant="gold" />
            <Btn label="Sign out" onPress={() => setOwnerOk(false)} variant="outline" />
          </View>
        </View>

        {flash ? (
          <View style={{ marginBottom: 12 }}>
            <Banner kind={flash.kind === "ok" ? "ok" : flash.kind === "err" ? "err" : "info"}>
              {flash.text}
            </Banner>
          </View>
        ) : null}

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
          <Text style={{ color: colors.muted, fontSize: 12 }}>Guest path: /c/{slug}/t/…</Text>
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
                  borderRadius: 8,
                  backgroundColor: c,
                  borderWidth: accent === c ? 2 : 1,
                  borderColor: accent === c ? colors.ink : colors.line,
                }}
              />
            ))}
          </View>
          <Field label="Custom hex" value={accent} onChangeText={setAccent} />
          <Field label="Tables (QR 01–N)" value={tables} onChangeText={setTables} keyboardType="number-pad" />
          <Toggle label={cash ? "Cash only · on" : "Cash only · off"} on={cash} onPress={() => setCash((v) => !v)} />
          <Toggle
            label={orderingOn ? "QR ordering · open" : "QR ordering · paused"}
            on={orderingOn}
            onPress={() => setOrderingOn((v) => !v)}
          />
          <Text style={styles.lbl}>Country (tax defaults)</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(Object.keys(COUNTRY_TAX_DEFAULTS) as CountryCode[]).map((code) => (
              <Chip
                key={code}
                label={`${code} · ${COUNTRY_TAX_DEFAULTS[code].label}`}
                active={country === code}
                onPress={() => {
                  const apply = () => {
                    const d = COUNTRY_TAX_DEFAULTS[code];
                    setCountry(code);
                    setCurrency(d.currency);
                    setTaxName(d.taxName);
                    setTaxPct(String(Math.round(d.taxRate * 10000) / 100));
                  };
                  const msg =
                    "Apply " +
                    COUNTRY_TAX_DEFAULTS[code].label +
                    " defaults (currency " +
                    COUNTRY_TAX_DEFAULTS[code].currency +
                    ", " +
                    COUNTRY_TAX_DEFAULTS[code].taxName +
                    " " +
                    Math.round(COUNTRY_TAX_DEFAULTS[code].taxRate * 100) +
                    "%)? Menu prices stay unchanged.";
                  if (Platform.OS === "web" && typeof window !== "undefined") {
                    if (window.confirm(msg)) apply();
                    else setCountry(code);
                  } else {
                    Alert.alert("Country defaults", msg, [
                      { text: "Country only", onPress: () => setCountry(code) },
                      { text: "Apply defaults", onPress: apply },
                    ]);
                  }
                }}
              />
            ))}
          </View>
          <Field
            label="Country code"
            value={country}
            onChangeText={(v) => setCountry(v.toUpperCase())}
            placeholder="NP / IN / US"
          />
          <Field
            label="Currency"
            value={currency}
            onChangeText={(v) => setCurrency(v.toUpperCase())}
            placeholder="NPR / INR / USD"
          />
          <Field label="Tax name" value={taxName} onChangeText={setTaxName} placeholder="VAT / GST / Tax" />
          <Field
            label="Tax rate (%)"
            value={taxPct}
            onChangeText={setTaxPct}
            placeholder="13"
            keyboardType="decimal-pad"
          />
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Nepal: country NP → NPR + VAT 13%. Prices stay as you set them; only tax/currency labels change.
          </Text>
          <Btn label={busy ? "Saving…" : "Save profile"} onPress={() => void saveProfile()} disabled={busy} />
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Categories</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Edit a name, then Save (or tab away). Deletes remove items in that category.</Text>
          {!sortedCats.length ? (
            <Text style={{ color: colors.muted }}>No categories yet — add one to start building the menu.</Text>
          ) : null}
          {sortedCats.map((c) => {
            const draft = catDrafts[c.id] ?? c.name;
            const dirty = draft.trim() !== c.name;
            return (
              <View key={c.id} style={styles.catRow}>
                <Field
                  value={draft}
                  onChangeText={(v) => setCatDrafts((d) => ({ ...d, [c.id]: v }))}
                  onBlur={() => {
                    if (!dirty) return;
                    void (async () => {
                      const r = await renameCategory(c.id, draft, { immediate: true });
                      if (r.ok) {
                        setCatDrafts((d) => ({ ...d, [c.id]: draft.trim() || c.name }));
                        flashMsg("ok", "Category renamed.");
                      } else flashMsg("err", r.error);
                    })();
                  }}
                  style={{ flex: 1 }}
                />
                {dirty ? (
                  <Btn
                    label="Save"
                    disabled={busy}
                    onPress={() => {
                      void (async () => {
                        setBusy(true);
                        try {
                          const r = await renameCategory(c.id, draft, { immediate: true });
                          if (r.ok) {
                            setCatDrafts((d) => ({ ...d, [c.id]: draft.trim() || c.name }));
                            flashMsg("ok", "Category renamed.");
                          } else flashMsg("err", r.error);
                        } finally {
                          setBusy(false);
                        }
                      })();
                    }}
                  />
                ) : null}
                <Pressable onPress={() => confirmDeleteCategory(c.id, c.name)} style={styles.kill} disabled={busy}>
                  <Text style={styles.killTxt}>Delete</Text>
                </Pressable>
              </View>
            );
          })}
          <View style={styles.catRow}>
            <View style={{ flex: 1 }}>
              <Field placeholder="New category" value={catName} onChangeText={setCatName} />
            </View>
            <Btn
              label={busy ? "…" : "Add"}
              disabled={busy || !catName.trim()}
              onPress={() => {
                void (async () => {
                  setBusy(true);
                  try {
                    const r = await addCategory(catName.trim());
                    if (r.ok) {
                      setCatName("");
                      flashMsg("ok", "Category added.");
                    } else flashMsg("err", r.error);
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.section}>Menu items</Text>
            <Btn label="New item" onPress={startNew} variant="gold" disabled={!sortedCats.length} />
          </View>
          {!items.length ? (
            <Text style={{ color: colors.muted }}>No items yet. Tap New item to add your first dish.</Text>
          ) : null}
          {sortedCats.map((c) => {
            const catItems = items.filter((i) => i.categoryId === c.id);
            return (
              <View key={c.id} style={{ gap: 8 }}>
                <Text style={styles.catHead}>{c.name}</Text>
                {!catItems.length ? (
                  <Text style={{ color: colors.faint, fontSize: 12 }}>Empty category</Text>
                ) : null}
                {catItems.map((it) => (
                  <View key={it.id} style={styles.itemRow}>
                    <Pressable
                      onPress={() => { setFormErr(""); setEditing(toDraft(it)); }}
                      style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}
                    >
                      <Image source={{ uri: it.image || DEFAULT_IMAGE }} style={[styles.thumb, it.available === false && { opacity: 0.45 }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemName}>{it.name}{it.available === false ? " · SOLD OUT" : ""}</Text>
                        <Text style={styles.itemMeta}>
                          {money(it.price, cur)} · {it.prepMinutes} min · {it.tags.join(" · ") || "no tags"}
                        </Text>
                      </View>
                      <Text style={styles.edit}>Edit</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        void (async () => {
                          setBusy(true);
                          try {
                            const r = await upsertItem({ ...it, available: it.available === false });
                            if (r.ok) flashMsg("ok", it.available === false ? "Marked available." : "Marked sold out.");
                            else flashMsg("err", r.error);
                          } finally {
                            setBusy(false);
                          }
                        })();
                      }}
                      style={styles.availBtn}
                      disabled={busy}
                    >
                      <Text style={styles.availTxt}>{it.available === false ? "Available" : "Sold out"}</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            );
          })}
          {orphanItems.length ? (
            <View style={{ gap: 8, marginTop: 8 }}>
              <Text style={styles.catHead}>Uncategorized</Text>
              {orphanItems.map((it) => (
                <Pressable key={it.id} onPress={() => { setFormErr(""); setEditing(toDraft(it)); }} style={styles.itemRow}>
                  <Image source={{ uri: it.image || DEFAULT_IMAGE }} style={styles.thumb} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{it.name}</Text>
                    <Text style={styles.itemMeta}>{money(it.price, cur)} · assign a category</Text>
                  </View>
                  <Text style={styles.edit}>Edit</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {editing ? (
          <View style={styles.card}>
            <Text style={styles.section}>{items.some((i) => i.id === editing.id) ? "Edit item" : "New item"}</Text>
            {formErr ? (
              <Banner kind="err">{formErr}</Banner>
            ) : null}
            <Field label="Name" value={editing.name} onChangeText={(v) => setEditing({ ...editing, name: v })} />
            <Field
              label="Description"
              value={editing.description}
              onChangeText={(v) => setEditing({ ...editing, description: v })}
              multiline
            />
            <Field
              label="Price"
              value={editing.priceStr}
              onChangeText={(v) => setEditing({ ...editing, priceStr: v, price: parseMoneyInput(v) })}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />
            <Field
              label="Prep minutes"
              value={editing.prepStr}
              onChangeText={(v) => setEditing({ ...editing, prepStr: v, prepMinutes: parseIntInput(v, 5) })}
              keyboardType="number-pad"
              placeholder="5"
            />
            <Field
              label="Photo URL (paste image link)"
              value={editing.image}
              onChangeText={(v) => setEditing({ ...editing, image: v })}
              placeholder="https://…"
              autoCapitalize="none"
            />
            {editing.image.trim() && !isHttpUrl(editing.image) ? (
              <Text style={{ color: colors.danger, fontSize: 12 }}>URL must be http(s).</Text>
            ) : null}
            {editing.image.trim() && isHttpUrl(editing.image) ? (
              <Image
                source={{ uri: editing.image.trim() }}
                style={styles.preview}
                resizeMode="cover"
                accessibilityLabel="Photo preview"
              />
            ) : (
              <Text style={{ color: colors.muted, fontSize: 12 }}>Paste an https image link to preview.</Text>
            )}
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
                onPress={() => {
                  const on = !editing.hasMilk;
                  let mods = parseModifiers(editing.modifiers);
                  mods = mods.filter((g) => !(g.id === "milk" || /milk/i.test(g.name)));
                  if (on) mods = [defaultMilkGroup(cur), ...mods];
                  const flags = syncFlagsFromModifiers(mods);
                  setEditing({ ...editing, hasMilk: flags.hasMilk, hasExtraShot: flags.hasExtraShot, modifiers: mods });
                }}
              />
              <Toggle
                label="Extra shot"
                on={editing.hasExtraShot}
                onPress={() => {
                  const on = !editing.hasExtraShot;
                  let mods = parseModifiers(editing.modifiers);
                  mods = mods.filter((g) => !(g.id === "extra-shot" || /extra\s*shot/i.test(g.name)));
                  if (on) mods = [...mods, defaultExtraShotGroup(cur)];
                  const flags = syncFlagsFromModifiers(mods);
                  setEditing({ ...editing, hasMilk: flags.hasMilk, hasExtraShot: flags.hasExtraShot, modifiers: mods });
                }}
              />
              <Toggle
                label={editing.available !== false ? "Available for order" : "Sold out"}
                on={editing.available !== false}
                onPress={() => setEditing({ ...editing, available: editing.available === false })}
              />
            </View>

            <Text style={[styles.section, { marginTop: 8 }]}>Customisations</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Groups of options (milk, toppings, etc.) with prices in {cur}.
            </Text>
            {(editing.modifiers || []).map((group, gi) => (
              <View key={group.id} style={styles.modCard}>
                <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Group name"
                      value={group.name}
                      onChangeText={(v) => {
                        const mods = parseModifiers(editing.modifiers).map((g, i) =>
                          i === gi ? { ...g, name: v } : g,
                        );
                        const flags = syncFlagsFromModifiers(mods);
                        setEditing({ ...editing, modifiers: mods, hasMilk: flags.hasMilk, hasExtraShot: flags.hasExtraShot });
                      }}
                    />
                  </View>
                  <Pressable
                    onPress={() => {
                      const mods = parseModifiers(editing.modifiers).filter((_, i) => i !== gi);
                      const flags = syncFlagsFromModifiers(mods);
                      setEditing({ ...editing, modifiers: mods, hasMilk: flags.hasMilk, hasExtraShot: flags.hasExtraShot });
                    }}
                    style={styles.kill}
                  >
                    <Text style={styles.killTxt}>Delete group</Text>
                  </Pressable>
                </View>
                {group.options.map((opt, oi) => (
                  <View key={opt.id} style={styles.optRow}>
                    <View style={{ flex: 1.4 }}>
                      <Field
                        label="Option"
                        value={opt.name}
                        onChangeText={(v) => {
                          const mods = parseModifiers(editing.modifiers).map((g, i) => {
                            if (i !== gi) return g;
                            return {
                              ...g,
                              options: g.options.map((o, j) => (j === oi ? { ...o, name: v } : o)),
                            };
                          });
                          setEditing({ ...editing, modifiers: mods });
                        }}
                      />
                    </View>
                    <View style={{ flex: 0.8 }}>
                      <Field
                        label={`Price (${cur})`}
                        value={String(opt.price ?? 0)}
                        onChangeText={(v) => {
                          const price = parseMoneyInput(v);
                          const mods = parseModifiers(editing.modifiers).map((g, i) => {
                            if (i !== gi) return g;
                            return {
                              ...g,
                              options: g.options.map((o, j) => (j === oi ? { ...o, price } : o)),
                            };
                          });
                          setEditing({ ...editing, modifiers: mods });
                        }}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <Pressable
                      onPress={() => {
                        const mods = parseModifiers(editing.modifiers).map((g, i) => {
                          if (i !== gi) return g;
                          return { ...g, options: g.options.filter((_, j) => j !== oi) };
                        });
                        setEditing({ ...editing, modifiers: mods });
                      }}
                      style={[styles.kill, { marginBottom: 2 }]}
                    >
                      <Text style={styles.killTxt}>Del</Text>
                    </Pressable>
                  </View>
                ))}
                <Btn
                  label="+ Add option"
                  variant="outline"
                  onPress={() => {
                    const mods = parseModifiers(editing.modifiers).map((g, i) => {
                      if (i !== gi) return g;
                      return {
                        ...g,
                        options: [...g.options, { id: nidShort("opt"), name: "New option", price: 0 }],
                      };
                    });
                    setEditing({ ...editing, modifiers: mods });
                  }}
                />
              </View>
            ))}
            <Btn
              label="+ Add customisation group"
              variant="outline"
              onPress={() => {
                const mods = [
                  ...parseModifiers(editing.modifiers),
                  { id: nidShort("grp"), name: "Options", required: false, max: 1, options: [{ id: nidShort("opt"), name: "Choice", price: 0 }] },
                ];
                const flags = syncFlagsFromModifiers(mods);
                setEditing({ ...editing, modifiers: mods, hasMilk: flags.hasMilk, hasExtraShot: flags.hasExtraShot });
              }}
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <View style={{ flex: 1, minWidth: 140 }}>
                <Btn label={busy ? "Saving…" : "Save item"} onPress={() => void saveItem()} variant="gold" disabled={busy} />
              </View>
              <View style={{ flex: 1, minWidth: 140 }}>
                <Btn label="Cancel" variant="outline" onPress={() => { setEditing(null); setFormErr(""); }} />
              </View>
            </View>
            {items.some((i) => i.id === editing.id) ? (
              <Pressable onPress={confirmDeleteItem} style={{ marginTop: 8 }} disabled={busy}>
                <Text style={styles.danger}>Delete item</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}


        <Text style={styles.section}>Login credentials</Text>
        <Text style={{ color: colors.muted, marginBottom: 8 }}>
          Change Cafe User ID, password, and PIN. User IDs must be unique across cafés.
        </Text>
        <Field label="Owner user id" value={credOwnerUser} onChangeText={setCredOwnerUser} />
        <Field label="Owner new password (blank = keep)" value={credOwnerPass} onChangeText={setCredOwnerPass} secureTextEntry />
        <Field label="Owner new PIN (blank = keep)" value={credOwnerPin} onChangeText={setCredOwnerPin} keyboardType="number-pad" />
        <Field label="Staff user id" value={credStaffUser} onChangeText={setCredStaffUser} />
        <Field label="Staff new password (blank = keep)" value={credStaffPass} onChangeText={setCredStaffPass} secureTextEntry />
        <Field label="Staff new PIN (blank = keep)" value={credStaffPin} onChangeText={setCredStaffPin} keyboardType="number-pad" />
        <Btn
          label={busy ? "Saving…" : "Save credentials"}
          disabled={busy}
          onPress={() => {
            void (async () => {
              setBusy(true);
              try {
                const body: Record<string, string> = {};
                if (credOwnerUser.trim()) body.ownerUser = credOwnerUser.trim();
                if (credStaffUser.trim()) body.staffUser = credStaffUser.trim();
                if (credOwnerPass) body.ownerPassword = credOwnerPass;
                if (credStaffPass) body.staffPassword = credStaffPass;
                if (credOwnerPin.trim()) body.ownerPin = credOwnerPin.trim();
                if (credStaffPin.trim()) body.staffPin = credStaffPin.trim();
                const r = await saveCafeCredentials(body);
                if (r.ok) {
                  setCredOwnerUser(r.ownerUser);
                  setCredStaffUser(r.staffUser);
                  setCredOwnerPass("");
                  setCredStaffPass("");
                  setCredOwnerPin("");
                  setCredStaffPin("");
                  flashMsg("ok", "Credentials updated");
                } else flashMsg("err", r.error);
              } finally {
                setBusy(false);
              }
            })();
          }}
        />

        <View style={styles.rowBetween}>
          <Text style={styles.section}>Printable QR sheet</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Btn label="Print" onPress={printSheet} variant="gold" />
            <Btn
              label="Restore demo"
              variant="outline"
              disabled={busy}
              onPress={() => {
                const msg = "Reset this café menu back to the demo seed? Custom edits will be lost.";
                const run = async () => {
                  setBusy(true);
                  try {
                    const r = await restoreDemo();
                    if (r.ok) {
                      setEditing(null);
                      flashMsg("ok", "Demo menu restored.");
                    } else flashMsg("err", r.error);
                  } finally {
                    setBusy(false);
                  }
                };
                if (Platform.OS === "web" && typeof window !== "undefined") {
                  if (window.confirm(msg)) void run();
                } else {
                  Alert.alert("Restore demo", msg, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Restore", style: "destructive", onPress: () => void run() },
                  ]);
                }
              }}
            />
          </View>
        </View>
      </View>

      <View style={styles.sheet} {...({ className: "qr-print-sheet" } as any)}>
        <View style={styles.qrGrid} {...({ className: "qr-print-grid" } as any)}>
          {Array.from({ length: count }, (_, i) => {
            const n = i + 1;
            const url = tableUrlFor(slug, n);
            return (
              <View key={n} style={styles.qrCard} {...({ className: "qr-print-cell" } as any)}>
                <QrImage
                  value={url}
                  caption={`TABLE ${String(n).padStart(2, "0")}`}
                  cafeName={cafe.name}
                  accentColor={cafe.accentColor}
                  cashOnly={cafe.cashOnly !== false}
                  size={132}
                  color={colors.ink}
                />
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
  h: { fontSize: 28, fontWeight: "800", letterSpacing: 0.2, color: colors.ink, marginTop: 6 },
  card: {
    backgroundColor: colors.white,
    borderWidth,
    borderColor: colors.line,
    borderRadius: radius,
    padding: 18,
    gap: 12,
    marginBottom: 16,
    ...shadow.card,
  },
  section: { fontSize: 13, fontWeight: "800", letterSpacing: 1.2, color: colors.ink, textTransform: "uppercase" },
  catRow: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  kill: {
    minHeight: 48,
    paddingHorizontal: 14,
    justifyContent: "center",
    borderWidth,
    borderColor: colors.line,
    borderRadius: radius,
    backgroundColor: colors.bg,
  },
  killTxt: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8, color: colors.danger, textTransform: "uppercase" },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  catHead: { fontSize: 12, fontWeight: "800", letterSpacing: 1.2, color: colors.muted, marginTop: 8, textTransform: "uppercase" },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth,
    borderColor: colors.line,
    borderRadius: radius,
    padding: 10,
    backgroundColor: colors.bg,
  },
  thumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: colors.wash },
  preview: {
    width: "100%",
    height: 160,
    borderRadius: radius,
    borderWidth,
    borderColor: colors.line,
    backgroundColor: colors.wash,
  },
  modCard: {
    borderWidth,
    borderColor: colors.line,
    borderRadius: radius,
    padding: 12,
    gap: 8,
    backgroundColor: colors.bg,
  },
  optRow: { flexDirection: "row", gap: 8, alignItems: "flex-end", flexWrap: "wrap" },
  itemName: { fontWeight: "800", color: colors.ink },
  itemMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  edit: { fontSize: 11, fontWeight: "800", letterSpacing: 1, color: colors.ink, textTransform: "uppercase" },
  lbl: { fontSize: 11, letterSpacing: 1.4, fontWeight: "700", textTransform: "uppercase", color: colors.muted },
  danger: { color: colors.danger, fontWeight: "800", letterSpacing: 1, fontSize: 12, textTransform: "uppercase" },
  sheet: { marginTop: 8, marginBottom: 40 },
  sheetTitle: { fontSize: 22, fontWeight: "800", letterSpacing: 0.4, color: colors.ink, textAlign: "center" },
  sheetSub: { textAlign: "center", color: colors.muted, marginTop: 6, marginBottom: 16 },
  qrGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center" },
  qrCard: {
    width: 210,
    backgroundColor: "transparent",
    padding: 0,
    alignItems: "stretch",
  },
  qr: { width: 160, height: 160 },
  qrTable: { fontWeight: "800", letterSpacing: 1.2, color: colors.ink },
  qrUrl: { fontSize: 10, color: colors.muted, textAlign: "center" },
  availBtn: {
    borderWidth,
    borderColor: colors.line,
    borderRadius: radius,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.white,
  },
  availTxt: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8, color: colors.ink, textTransform: "uppercase" },
});
