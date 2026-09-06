
export interface ModifierOption {
  id: string;
  name: string;
  price: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  required?: boolean;
  max?: number;
  options: ModifierOption[];
}

export interface ModifierSelection {
  groupId: string;
  optionId: string;
}

export type DietaryTag = "popular" | "veg" | "vegan" | "gf";

export type MilkOption = "whole" | "oat" | "almond" | "skim";

export type OrderStatus = "new" | "preparing" | "ready" | "paid" | "cancelled";

export type DietaryFilter = "all" | "veg" | "vegan" | "gf";

export type CurrencyCode = "USD" | "INR" | "NPR";

export type DiningOption = "dine_in" | "takeaway";

export interface CafeProfile {
  slug: string;
  name: string;
  tagline: string;
  accentColor: string;
  hours: string;
  tableCount: number;
  cashOnly: boolean;
  currency: CurrencyCode;
  country: string;
  taxName: string;
  /** Fraction, e.g. 0.13 for 13% VAT */
  taxRate: number;
  /** Alt-milk surcharge (currency units). Defaults by currency if unset. */
  altMilkPrice: number;
  /** Extra-shot surcharge (currency units). Defaults by currency if unset. */
  extraShotPrice: number;
  address: string;
  orderingEnabled: boolean;
  /** Rotating ticker lines under cafe name (owner-set) */
  headerMessages: string[];
  /** When false, guest order status page hides live detail */
  guestStatusEnabled: boolean;
  lastCallEnabled: boolean;
  lastCallMessage: string;
  /** Epoch ms when last-call window ends; null if unset */
  lastCallEndsAt: number | null;
  /** Epoch ms; bumps on profile/menu changes for guest live refresh */
  updatedAt?: number;
}

export interface MenuCategory {
  id: string;
  name: string;
  sort: number;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  prepMinutes: number;
  tags: DietaryTag[];
  image: string;
  hasMilk: boolean;
  hasExtraShot: boolean;
  /** Structured customisations; empty → guest falls back to hasMilk/hasExtraShot */
  modifiers?: ModifierGroup[];
  available: boolean;
}

export interface CartLine {
  lineId: string;
  itemId: string;
  qty: number;
  milk?: MilkOption;
  extraShot?: boolean;
  selections?: ModifierSelection[];
}

export interface GuestSession {
  phone: string;
  name: string;
  welcomedTables: string[];
}

export interface OrderLine {
  itemId: string;
  name: string;
  qty: number;
  unitPrice: number;
  milk?: MilkOption;
  extraShot?: boolean;
  selections?: ModifierSelection[];
}

export interface Order {
  id: string;
  table: string;
  guestName: string;
  phone: string;
  notes: string;
  items: OrderLine[];
  subtotal: number;
  tax: number;
  /** Snapshot of cafe tax label at order time */
  taxName?: string;
  total: number;
  status: OrderStatus;
  createdAt: number;
  estimatedWait: number;
  payCash: boolean;
  confirmCode: string;
  diningOption: DiningOption;
}

/** @deprecated Prefer cafe.taxRate */
export const TAX_RATE = 0.08;
/** @deprecated Prefer cafe.taxRate */
export const INR_GST_RATE = 0.05;

export type CountryCode = "NP" | "IN" | "US";

export const COUNTRY_TAX_DEFAULTS: Record<
  CountryCode,
  { currency: CurrencyCode; taxName: string; taxRate: number; label: string }
> = {
  NP: { currency: "NPR", taxName: "VAT", taxRate: 0.13, label: "Nepal" },
  IN: { currency: "INR", taxName: "GST", taxRate: 0.05, label: "India" },
  US: { currency: "USD", taxName: "Tax", taxRate: 0.08, label: "United States" },
};
/** @deprecated Prefer cafe.extraShotPrice / surchargeFor(currency) */
export const EXTRA_SHOT_PRICE = 0.75;
/** @deprecated Prefer cafe.altMilkPrice / surchargeFor(currency) */
export const ALT_MILK_PRICE = 0.5;

export function surchargeDefaults(currency?: string): { altMilk: number; extraShot: number } {
  const c = String(currency || "USD").toUpperCase();
  if (c === "NPR") return { altMilk: 25, extraShot: 40 };
  if (c === "INR") return { altMilk: 20, extraShot: 30 };
  return { altMilk: 0.5, extraShot: 0.75 };
}

/** Demo seed cafes only — new cafes cannot use 1234 via API. */
export const OWNER_PIN = "1234";
export const STAFF_PIN = "1234";
export const MILK_LABELS: Record<MilkOption, string> = {
  whole: "Whole milk",
  oat: "Oat milk",
  almond: "Almond milk",
  skim: "Skim milk",
};
