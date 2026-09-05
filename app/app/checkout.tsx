import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";

import { Btn, Field, Loading, Screen } from "@/components/ui";
import { cartTotals, lineUnitPrice, money, optionBlurb, padTable, tableLabel, waitCopy } from "@/lib/format";
import { useStore } from "@/lib/store";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { borderWidth, colors, radius } from "@/lib/theme";
import { TAX_RATE } from "@/lib/types";

export default function Checkout() {
  const params = useLocalSearchParams<{ table?: string; slug?: string }>();
  const { cart, items, cafe, guest, cartTable, ready, placeOrder } = useStore();
  const table = padTable(String(params.table || cartTable || "04"));
  const [name, setName] = useState(guest.name);
  const [phone, setPhone] = useState(guest.phone);
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const totals = cartTotals(cart, items, cafe.currency || "USD");
  const cur = cafe.currency || "USD";

  if (!ready) return <Loading />;

  const submit = async () => {
    if (!cart.length) {
      setErr("Your bag is empty.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const order = await placeOrder({
        table,
        guestName: name,
        phone,
        notes,
      });
      if (!order) {
        setErr("Could not place order. Check your connection and try again.");
        void hapticError();
        return;
      }
      void hapticSuccess();
      router.replace(`/order/${order.id}` as any);
    } catch (e) {
      setErr("Could not place order. Check your connection and try again.");
      void hapticError();
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen maxWidth={640}>
        <Text style={styles.k}>Cash checkout</Text>
        <Text style={styles.h}>PLACE YOUR ORDER</Text>
        <Text style={styles.sub}>
          {tableLabel(table)} · {cafe.name}. Pay cash at the counter when you pick up.
        </Text>

        <View style={styles.card}>
          <Field label="Table" value={tableLabel(table)} editable={false} />
          <Field label="Name" value={name} onChangeText={setName} placeholder="Guest name (optional)" />
          <Field
            label="Mobile"
            value={phone}
            onChangeText={setPhone}
            placeholder="If you entered it at the door"
            keyboardType="phone-pad"
          />
          <Field
            label="Notes for the kitchen"
            value={notes}
            onChangeText={setNotes}
            placeholder="Allergies, extra hot, no foam…"
            multiline
            style={{ minHeight: 88, textAlignVertical: "top", paddingTop: 12 }}
          />
        </View>

        <View style={styles.card}>
          {cart.map((line) => {
            const item = items.find((i) => i.id === line.itemId);
            if (!item) return null;
            const extra = optionBlurb(line.milk, line.extraShot);
            return (
              <View key={line.lineId} style={styles.row}>
                <Text style={styles.lineTxt}>
                  {line.qty}× {item.name.toUpperCase()}
                  {extra ? `\n${extra}` : ""}
                </Text>
                <Text style={styles.lineAmt}>{money(lineUnitPrice(item, line.milk, line.extraShot) * line.qty, cur)}</Text>
              </View>
            );
          })}
          {!cart.length ? <Text style={{ color: colors.muted }}>Bag is empty — add something from the menu.</Text> : null}
          <View style={styles.rule} />
          <View style={styles.row}>
            <Text style={styles.muted}>Subtotal</Text>
            <Text>{money(totals.subtotal, cur)}</Text>
          </View>
          {cur === "INR" ? null : (
            <View style={styles.row}>
              <Text style={styles.muted}>Tax ({(TAX_RATE * 100).toFixed(1)}%)</Text>
              <Text>{money(totals.tax, cur)}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.due}>TOTAL DUE (CASH)</Text>
            <Text style={styles.dueAmt}>{money(totals.total, cur)}</Text>
          </View>
          <Text style={styles.wait}>Est. prep {waitCopy(totals.wait)}</Text>
        </View>

        {cafe.cashOnly ? (
          <View style={styles.cash}>
            <Text style={styles.cashTxt}>CASH ONLY — HAND EXACT CASH TO THE COUNTER CASHIER.</Text>
          </View>
        ) : null}

        {err ? <Text style={styles.err}>{err}</Text> : null}

        <Btn label={busy ? "Placing…" : "Place cash order"} onPress={submit} disabled={!cart.length || busy} variant="gold" />
        <View style={{ height: 10 }} />
        <Btn label="Back to menu" variant="outline" href={`/c/${cafe.slug || "velvet-bean"}/t/${table}` as any} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  k: { fontSize: 11, fontWeight: "800", letterSpacing: 2, color: colors.gold, textTransform: "uppercase" },
  h: { fontSize: 28, fontWeight: "800", letterSpacing: 0.6, color: colors.ink, marginTop: 8 },
  sub: { color: colors.muted, marginTop: 8, marginBottom: 22, lineHeight: 22 },
  card: {
    backgroundColor: colors.white,
    borderWidth,
    borderColor: colors.line,
    borderRadius: radius,
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  lineTxt: { flex: 1, fontWeight: "700", color: colors.ink, fontSize: 13 },
  lineAmt: { fontWeight: "800", color: colors.ink },
  rule: { height: 1.5, backgroundColor: colors.ink },
  muted: { color: colors.muted },
  due: { fontWeight: "800", letterSpacing: 1, color: colors.ink, fontSize: 13 },
  dueAmt: { fontWeight: "800", fontSize: 20, color: colors.ink },
  wait: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  cash: {
    backgroundColor: colors.goldSoft,
    borderWidth,
    borderColor: colors.line,
    padding: 12,
    marginBottom: 16,
  },
  cashTxt: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8, color: colors.ink },
  err: { color: colors.danger, marginBottom: 12, fontWeight: "700" },
});
