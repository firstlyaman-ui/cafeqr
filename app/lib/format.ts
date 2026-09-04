import {
  ALT_MILK_PRICE,
  EXTRA_SHOT_PRICE,
  TAX_RATE,
  type CartLine,
  type MenuItem,
  type MilkOption,
  type OrderStatus,
} from "./types";

export function money(n: number, currency: string = "USD"): string {
  if (currency === "INR") {
    if (Number.isInteger(n)) return `₹${n}`;
    return `₹${n.toFixed(2)}`;
  }
  return `$${n.toFixed(2)}`;
}

export function tableLabel(id: string): string {
  const n = String(id).replace(/\D/g, "").padStart(2, "0") || "01";
  return `TABLE #${n}`;
}

export function padTable(id: string): string {
  return String(id).replace(/\D/g, "").padStart(2, "0") || "01";
}

export function lineUnitPrice(item: MenuItem, milk?: MilkOption, extraShot?: boolean): number {
  let p = item.price;
  if (milk === "oat" || milk === "almond") p += ALT_MILK_PRICE;
  if (extraShot) p += EXTRA_SHOT_PRICE;
  return p;
}

export function cartTotals(lines: CartLine[], items: MenuItem[]) {
  const subtotal = lines.reduce((sum, line) => {
    const item = items.find((i) => i.id === line.itemId);
    if (!item) return sum;
    return sum + lineUnitPrice(item, line.milk, line.extraShot) * line.qty;
  }, 0);
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const wait = lines.reduce((max, line) => {
    const item = items.find((i) => i.id === line.itemId);
    return Math.max(max, item ? item.prepMinutes : 0);
  }, 0);
  return { subtotal: Math.round(subtotal * 100) / 100, tax, total, count, wait };
}

export function optionBlurb(milk?: MilkOption, extraShot?: boolean): string {
  const bits: string[] = [];
  if (milk) {
    const labels: Record<MilkOption, string> = {
      whole: "Whole",
      oat: "Oat +$0.50",
      almond: "Almond +$0.50",
      skim: "Skim",
    };
    bits.push(labels[milk]);
  }
  if (extraShot) bits.push("Extra shot +$0.75");
  return bits.join(" · ");
}

export function statusLabel(s: OrderStatus): string {
  return { new: "New", preparing: "Preparing", ready: "Ready", paid: "Paid" }[s];
}

export function nextStatus(s: OrderStatus): OrderStatus | null {
  if (s === "new") return "preparing";
  if (s === "preparing") return "ready";
  if (s === "ready") return "paid";
  return null;
}

export function nextStatusLabel(s: OrderStatus): string | null {
  if (s === "new") return "Mark preparing";
  if (s === "preparing") return "Mark ready";
  if (s === "ready") return "Mark paid";
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

export function timeAgo(ts: number): string {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (m < 1) return "just now";
  if (m === 1) return "1 min ago";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h === 1 ? "1 hr ago" : `${h} hr ago`;
}
