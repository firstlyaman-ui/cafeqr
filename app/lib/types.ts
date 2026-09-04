export type DietaryTag = "popular" | "veg" | "vegan" | "gf";

export type MilkOption = "whole" | "oat" | "almond" | "skim";

export type OrderStatus = "new" | "preparing" | "ready" | "paid";

export type DietaryFilter = "all" | "veg" | "vegan" | "gf";

export type CurrencyCode = "USD" | "INR";

export interface CafeProfile {
  slug: string;
  name: string;
  tagline: string;
  accentColor: string;
  hours: string;
  tableCount: number;
  cashOnly: boolean;
  currency: CurrencyCode;
  address: string;
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
  total: number;
  status: OrderStatus;
  createdAt: number;
  estimatedWait: number;
  payCash: boolean;
}

export const TAX_RATE = 0.08;
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
