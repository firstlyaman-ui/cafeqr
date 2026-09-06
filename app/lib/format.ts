import {
  ALT_MILK_PRICE,
  EXTRA_SHOT_PRICE,
  surchargeDefaults,
  type CartLine,
  type CafeProfile,
  type MenuItem,
  type MilkOption,
  type ModifierSelection,
  type OrderStatus,
} from "./types";
import {
  blurbFromSelections,
  effectiveModifiers,
  legacyFromSelections,
  priceWithSelections,
} from "./modifiers";

export function money(n: number, currency: string = "USD"): string {
  const v = Number.isFinite(n) ? n : 0;
  const code = String(currency || "USD").toUpperCase();
  try {
    if (code === "NPR") {
      return Number.isInteger(v) ? `Rs ${v}` : `Rs ${v.toFixed(2)}`;
    }
    if (code === "INR") {
      return Number.isInteger(v) ? `₹${v}` : `₹${v.toFixed(2)}`;
    }
    if (code === "USD") {
      return `$${v.toFixed(2)}`;
    }
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(v);
  } catch {
    return `${code} ${v.toFixed(2)}`;
  }
}

/** "VAT (13%)" / "GST (5%)" / "Tax (8%)" */
export function taxLabel(taxName?: string, taxRate?: number): string {
  const name = (taxName || "Tax").trim() || "Tax";
  const rate = Number(taxRate);
  if (!Number.isFinite(rate) || rate <= 0) return name;
  const pct = Math.round(rate * 10000) / 100;
  const pctStr = Number.isInteger(pct) ? String(pct) : String(pct);
  return `${name} (${pctStr}%)`;
}

/** Optional India GST split when name is GST and rate is 5%. */
export function isGstSplit(taxName?: string, taxRate?: number): boolean {
  const name = String(taxName || "").trim().toUpperCase();
  const rate = Number(taxRate);
  return name === "GST" && Number.isFinite(rate) && Math.abs(rate - 0.05) < 0.0001;
}

/** Parse price / prep fields without NaN mid-edit. */
export function parseMoneyInput(raw: string): number {
  const cleaned = String(raw ?? "").replace(/[^0-9.]/g, "");
  if (!cleaned || cleaned === ".") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function parseIntInput(raw: string, fallback = 0): number {
  const n = parseInt(String(raw ?? "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? Math.max(0, n) : fallback;
}

export function isHttpUrl(url: string): boolean {
  const s = String(url || "").trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function tableLabel(id: string): string {
  const n = String(id).replace(/\D/g, "").padStart(2, "0") || "01";
  return `TABLE #${n}`;
}

export function padTable(id: string): string {
  return String(id).replace(/\D/g, "").padStart(2, "0") || "01";
}

export function lineUnitPrice(
  item: MenuItem,
  milkOrOpts?: MilkOption | { milk?: MilkOption; extraShot?: boolean; selections?: ModifierSelection[] },
  extraShot?: boolean,
  cafe?: Pick<CafeProfile, "currency" | "altMilkPrice" | "extraShotPrice"> | string,
): number {
  const cafeObj = typeof cafe === "string" ? undefined : cafe;
  const currency = typeof cafe === "string" ? cafe : cafe?.currency;
  const opts =
    milkOrOpts && typeof milkOrOpts === "object" && !Array.isArray(milkOrOpts) && ("selections" in milkOrOpts || "milk" in milkOrOpts || "extraShot" in milkOrOpts)
      ? (milkOrOpts as { milk?: MilkOption; extraShot?: boolean; selections?: ModifierSelection[] })
      : { milk: milkOrOpts as MilkOption | undefined, extraShot };

  const mods = effectiveModifiers(item, cafeObj ? { currency: cafeObj.currency, altMilkPrice: cafeObj.altMilkPrice, extraShotPrice: cafeObj.extraShotPrice } : undefined);
  if (mods.length) {
    let selections = opts.selections;
    if (!selections?.length) {
      const sels: ModifierSelection[] = [];
      if (opts.milk) sels.push({ groupId: "milk", optionId: String(opts.milk) });
      if (opts.extraShot) sels.push({ groupId: "extra-shot", optionId: "yes" });
      selections = sels;
    }
    return priceWithSelections(item.price, mods, selections);
  }

  const defaults = surchargeDefaults(currency);
  const alt =
    cafeObj && Number.isFinite(Number(cafeObj.altMilkPrice)) ? Number(cafeObj.altMilkPrice) : defaults.altMilk;
  const shot =
    cafeObj && Number.isFinite(Number(cafeObj.extraShotPrice)) ? Number(cafeObj.extraShotPrice) : defaults.extraShot;
  let p = item.price;
  if (opts.milk === "oat" || opts.milk === "almond") p += alt;
  if (opts.extraShot) p += shot;
  return p;
}

export function cartTotals(
  lines: CartLine[],
  items: MenuItem[],
  cafeOrCurrency?: Pick<CafeProfile, "currency" | "taxRate" | "taxName" | "altMilkPrice" | "extraShotPrice"> | string,
) {
  const cafe =
    typeof cafeOrCurrency === "string" || cafeOrCurrency === undefined
      ? {
          currency: (typeof cafeOrCurrency === "string" ? cafeOrCurrency : "USD") as string,
          taxRate: cafeOrCurrency === "INR" ? 0.05 : cafeOrCurrency === "NPR" ? 0.13 : 0.08,
          taxName: cafeOrCurrency === "INR" ? "GST" : cafeOrCurrency === "NPR" ? "VAT" : "Tax",
        }
      : cafeOrCurrency;
  const currency = cafe.currency || "USD";
  const rate = Number.isFinite(Number(cafe.taxRate)) ? Number(cafe.taxRate) : 0.08;
  const taxName = cafe.taxName || "Tax";

  const subtotal = lines.reduce((sum, line) => {
    const item = items.find((i) => i.id === line.itemId);
    if (!item) return sum;
    return sum + lineUnitPrice(item, { milk: line.milk, extraShot: line.extraShot, selections: line.selections }, undefined, cafe) * line.qty;
  }, 0);
  const roundedSub = Math.round(subtotal * 100) / 100;
  const tax = Math.round(roundedSub * rate * 100) / 100;
  const total = Math.round((roundedSub + tax) * 100) / 100;
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const wait = lines.reduce((max, line) => {
    const item = items.find((i) => i.id === line.itemId);
    return Math.max(max, item ? item.prepMinutes : 0);
  }, 0);
  const split = isGstSplit(taxName, rate);
  const cgst = split ? Math.round((tax / 2) * 100) / 100 : 0;
  const sgst = split ? Math.round((tax - cgst) * 100) / 100 : 0;
  return {
    subtotal: roundedSub,
    tax,
    total,
    count,
    wait,
    cgst,
    sgst,
    taxRate: rate,
    taxName,
    gstRate: rate,
    currency,
  };
}

export function optionBlurb(
  milk?: MilkOption | { milk?: MilkOption; extraShot?: boolean; selections?: ModifierSelection[]; item?: MenuItem },
  extraShot?: boolean,
  cafe?: Pick<CafeProfile, "currency" | "altMilkPrice" | "extraShotPrice">,
  item?: MenuItem,
): string {
  const opts =
    milk && typeof milk === "object" && ("selections" in milk || "item" in milk || "milk" in milk || "extraShot" in milk)
      ? (milk as { milk?: MilkOption; extraShot?: boolean; selections?: ModifierSelection[]; item?: MenuItem })
      : { milk: milk as MilkOption | undefined, extraShot, item };
  const cur = cafe?.currency || "USD";
  const menuItem = opts.item || item;
  if (menuItem) {
    const mods = effectiveModifiers(menuItem, cafe);
    if (mods.length && opts.selections?.length) {
      return blurbFromSelections(mods, opts.selections, cur, money);
    }
    if (mods.length && (opts.milk || opts.extraShot)) {
      const sels: ModifierSelection[] = [];
      if (opts.milk) sels.push({ groupId: "milk", optionId: String(opts.milk) });
      if (opts.extraShot) sels.push({ groupId: "extra-shot", optionId: "yes" });
      return blurbFromSelections(mods, sels, cur, money);
    }
  }
  const bits: string[] = [];
  const defaults = surchargeDefaults(cafe?.currency);
  const alt = cafe && Number.isFinite(Number(cafe.altMilkPrice)) ? Number(cafe.altMilkPrice) : defaults.altMilk;
  const shot =
    cafe && Number.isFinite(Number(cafe.extraShotPrice)) ? Number(cafe.extraShotPrice) : defaults.extraShot;
  if (opts.milk) {
    const labels: Record<string, string> = {
      whole: "Whole",
      oat: `Oat +${money(alt, cur)}`,
      almond: `Almond +${money(alt, cur)}`,
      skim: "Skim",
    };
    bits.push(labels[opts.milk] || String(opts.milk));
  }
  if (opts.extraShot) bits.push(`Extra shot +${money(shot, cur)}`);
  return bits.join(" · ");
}

export function statusLabel(s: OrderStatus): string {
  return { new: "New", preparing: "Preparing", ready: "Ready", paid: "Paid", cancelled: "Cancelled" }[s];
}

/** Cash-first kitchen flow: new (await cash) → preparing → ready (terminal). */
export function nextStatus(s: OrderStatus): OrderStatus | null {
  if (s === "new") return "preparing";
  if (s === "preparing") return "ready";
  return null;
}

export function nextStatusLabel(s: OrderStatus, _confirmCode?: string): string | null {
  if (s === "new") return "Cash received · Approve";
  if (s === "preparing") return "Mark ready";
  return null;
}

export function waitCopy(mins: number): string {
  const lo = Math.max(2, mins);
  const hi = lo + 4;
  return `${lo}–${hi} min`;
}

export function nid(prefix = "id"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function orderCode(prefix = "VB"): string {
  const n = 1000 + Math.floor(Math.random() * 9000);
  return `${prefix}-${n}`;
}

export function orderPrefixFromSlug(slug: string): string {
  const parts = String(slug || "cq").split("-").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return String(slug).slice(0, 2).toUpperCase() || "CQ";
}

export function genConfirmCode(): string {
  return String(1000 + Math.floor(Math.random() * 9000));
}

export function timeAgo(ts: number): string {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (m < 1) return "just now";
  if (m === 1) return "1 min ago";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h === 1 ? "1 hr ago" : `${h} hr ago`;
}
