import { Platform, Share } from "react-native";

import { money, optionBlurb, tableLabel } from "./format";
import type { CafeProfile, Order } from "./types";

export function diningLabel(opt?: string): string {
  return opt === "takeaway" ? "Takeaway" : "Dine in";
}

export function buildReceiptText(cafe: CafeProfile, order: Order): string {
  const cur = cafe.currency || "USD";
  const lines = [
    cafe.name,
    `Order ${order.id}`,
    tableLabel(order.table),
    `Guest: ${order.guestName}`,
    `Type: ${diningLabel(order.diningOption)}`,
    order.confirmCode ? `Staff code: ${order.confirmCode}` : "",
    "",
    ...order.items.map((l) => {
      const extra = optionBlurb(l.milk, l.extraShot);
      return `${l.qty}× ${l.name}${extra ? ` (${extra})` : ""}  ${money(l.unitPrice * l.qty, cur)}`;
    }),
    "",
    `Subtotal  ${money(order.subtotal, cur)}`,
  ];
  if (cur === "INR") {
    const half = Math.round((order.tax / 2) * 100) / 100;
    lines.push(`CGST (2.5%)  ${money(half, cur)}`);
    lines.push(`SGST (2.5%)  ${money(order.tax - half, cur)}`);
  } else if (order.tax > 0) {
    lines.push(`Tax  ${money(order.tax, cur)}`);
  }
  lines.push(`Total  ${money(order.total, cur)}`);
  if (order.payCash) lines.push("Cash due at counter");
  if (order.notes) lines.push(`Note: ${order.notes}`);
  return lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
}

/** WhatsApp on web; native Share sheet when available. */
export async function shareReceipt(cafe: CafeProfile, order: Order): Promise<void> {
  const text = buildReceiptText(cafe, order);
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  try {
    await Share.share({ message: text, title: `CafeQR ${order.id}` });
  } catch {
    /* cancelled */
  }
}
