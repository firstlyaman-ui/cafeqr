export type DietaryTag = "popular" | "veg" | "vegan" | "gf";

export type MilkOption = "whole" | "oat" | "almond" | "skim";

export type OrderStatus = "new" | "preparing" | "ready" | "paid";

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
  address: string;
  orderingEnabled: boolean;
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
  available: boolean;
}

export interface CartLine {
  lineId: string;
  itemId: string;
  qty: number;
  milk?: MilkOption;
  extraShot?: boolean;
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
export const EXTRA_SHOT_PRICE = 0.75;
export const ALT_MILK_PRICE = 0.5;
export const OWNER_PIN = "1234";
export const STAFF_PIN = "1234";
export const MILK_LABELS: Record<MilkOption, string> = {
  whole: "Whole milk",
  oat: "Oat milk",
  almond: "Almond milk",
  skim: "Skim milk",
};
