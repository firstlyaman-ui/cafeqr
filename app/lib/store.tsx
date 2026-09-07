import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import * as api from "./api";
import { APP_ROLE } from "./appRole";
import { cartTotals, genConfirmCode, lineUnitPrice, nid, orderCode, orderPrefixFromSlug } from "./format";
import { demoCafe, demoCategories, demoItems, demoOrders } from "./seed";
import type {
  CafeProfile,
  CartLine,
  DietaryTag,
  DiningOption,
  GuestSession,
  MenuCategory,
  MenuItem,
  MilkOption,
  ModifierSelection,
  Order,
  OrderStatus,
} from "./types";
import { selectionsKey } from "./modifiers";
import { OWNER_PIN, STAFF_PIN, surchargeDefaults } from "./types";

export type StoreResult = { ok: true } | { ok: false; error: string };

function errMsg(e: unknown, fallback = "Request failed"): string {
  if (e && typeof e === "object" && "message" in e && typeof (e as any).message === "string") {
    return (e as any).message || fallback;
  }
  return fallback;
}

const KEY = `cafeqr-${APP_ROLE}-v2`;
const DEFAULT_SLUG = "velvet-bean";

interface Persist {
  cafe: CafeProfile;
  categories: MenuCategory[];
  items: MenuItem[];
  cart: CartLine[];
  cartTable: string | null;
  guest: GuestSession;
  orders: Order[];
  cafeSlug: string;
}

const emptyGuest: GuestSession = { phone: "", name: "", welcomedTables: [] };

function localDefaults(slug = DEFAULT_SLUG): Persist {
  return {
    cafe: { ...demoCafe, slug },
    categories: demoCategories.map((c) => ({ ...c })),
    items: demoItems.map((i) => ({ ...i, tags: [...i.tags] as DietaryTag[], available: i.available !== false })),
    cart: [],
    cartTable: null,
    guest: { ...emptyGuest },
    orders: demoOrders(),
    cafeSlug: slug,
  };
}

function mapApiCafe(c: {
  slug: string;
  name: string;
  tagline: string;
  accentColor: string;
  hours: string;
  address: string;
  tableCount: number;
  cashOnly: boolean;
  currency: string;
  country?: string;
  taxName?: string;
  taxRate?: number;
  altMilkPrice?: number;
  extraShotPrice?: number;
  orderingEnabled?: boolean;
  headerMessages?: string[];
  guestStatusEnabled?: boolean;
  lastCallEnabled?: boolean;
  lastCallMessage?: string;
  lastCallEndsAt?: number | null;
  updatedAt?: number;
}): CafeProfile {
  const currency = (c.currency === "INR" || c.currency === "NPR" || c.currency === "USD" ? c.currency : "USD") as CafeProfile["currency"];
  const taxRate =
    typeof c.taxRate === "number" && Number.isFinite(c.taxRate)
      ? c.taxRate
      : currency === "INR"
        ? 0.05
        : currency === "NPR"
          ? 0.13
          : 0.08;
  const taxName =
    (c.taxName && String(c.taxName).trim()) ||
    (currency === "INR" ? "GST" : currency === "NPR" ? "VAT" : "Tax");
  const sur = surchargeDefaults(currency);
  const altMilkPrice =
    typeof c.altMilkPrice === "number" && Number.isFinite(c.altMilkPrice) ? c.altMilkPrice : sur.altMilk;
  const extraShotPrice =
    typeof c.extraShotPrice === "number" && Number.isFinite(c.extraShotPrice) ? c.extraShotPrice : sur.extraShot;
  return {
    slug: c.slug,
    name: c.name,
    tagline: c.tagline,
    accentColor: c.accentColor,
    hours: c.hours,
    address: c.address,
    tableCount: c.tableCount,
    cashOnly: c.cashOnly,
    currency,
    country: (c.country && String(c.country).toUpperCase()) || (currency === "INR" ? "IN" : currency === "NPR" ? "NP" : "US"),
    taxName,
    taxRate,
    altMilkPrice,
    extraShotPrice,
    orderingEnabled: c.orderingEnabled !== false,
    headerMessages: Array.isArray(c.headerMessages)
      ? c.headerMessages.map((s) => String(s || "").trim()).filter(Boolean)
      : [],
    guestStatusEnabled: !!c.guestStatusEnabled,
    lastCallEnabled: !!c.lastCallEnabled,
    lastCallMessage: c.lastCallMessage ? String(c.lastCallMessage) : "",
    lastCallEndsAt:
      c.lastCallEndsAt === undefined || c.lastCallEndsAt === null || c.lastCallEndsAt === ("" as any)
        ? null
        : Number(c.lastCallEndsAt),
    updatedAt: typeof c.updatedAt === "number" ? c.updatedAt : undefined,
  };
}

function mapApiItem(i: {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  prepMinutes: number;
  tags: string[];
  image: string;
  hasMilk: boolean;
  hasExtraShot: boolean;
  modifiers?: MenuItem["modifiers"];
  available?: boolean;
}): MenuItem {
  return {
    id: i.id,
    categoryId: i.categoryId,
    name: i.name,
    description: i.description,
    price: i.price,
    prepMinutes: i.prepMinutes,
    tags: (i.tags || []) as DietaryTag[],
    image: i.image,
    hasMilk: i.hasMilk,
    hasExtraShot: i.hasExtraShot,
    modifiers: Array.isArray(i.modifiers) ? i.modifiers : [],
    available: i.available !== false,
  };
}

function mapApiOrder(o: any): Order {
  return {
    id: o.id,
    table: o.table,
    guestName: o.guestName,
    phone: o.phone || "",
    notes: o.notes || "",
    items: o.items || [],
    subtotal: o.subtotal,
    tax: o.tax,
    total: o.total,
    status: o.status,
    createdAt: o.createdAt,
    estimatedWait: o.estimatedWait,
    payCash: o.payCash !== false,
    confirmCode: o.confirmCode || "",
    diningOption: o.diningOption === "takeaway" ? "takeaway" : "dine_in",
    taxName: o.taxName || "",
  };
}

interface Store extends Persist {
  ready: boolean;
  apiOnline: boolean;
  cafeList: api.ApiCafeListItem[];
  ownerOk: boolean;
  staffOk: boolean;
  ownerPin: string;
  staffPin: string;
  setOwnerOk: (v: boolean) => void;
  setStaffOk: (v: boolean) => void;
  setOwnerPin: (p: string) => void;
  setStaffPin: (p: string) => void;
  loadCafe: (slug: string) => Promise<void>;
  refreshOrders: () => Promise<void>;
  refreshCafeList: () => Promise<void>;
  saveCafe: (p: Partial<CafeProfile>) => Promise<StoreResult>;
  addCategory: (name: string) => Promise<StoreResult>;
  renameCategory: (id: string, name: string, opts?: { immediate?: boolean }) => Promise<StoreResult>;
  deleteCategory: (id: string) => Promise<StoreResult>;
  upsertItem: (item: MenuItem) => Promise<StoreResult>;
  deleteItem: (id: string) => Promise<StoreResult>;
  restoreDemo: () => Promise<StoreResult>;
  markWelcomed: (table: string) => void;
  setGuest: (g: Partial<GuestSession>) => void;
  addToCart: (itemId: string, opts?: { milk?: MilkOption | string; extraShot?: boolean; selections?: ModifierSelection[] }, table?: string) => void;
  setQty: (lineId: string, qty: number) => void;
  removeLine: (lineId: string) => void;
  clearCart: () => void;
  placeOrder: (input: {
    table: string;
    guestName: string;
    phone: string;
    notes: string;
    diningOption?: DiningOption;
  }) => Promise<Order | null>;
  setOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
  fetchGuestOrder: (id: string, confirm?: string) => Promise<{ ok: true; order: Order } | { ok: false; error: string; status?: number }>;
  rejectOrder: (id: string) => Promise<void>;
  cancelGuestOrder: (id: string, confirm?: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  verifyOwnerPin: (pin: string) => Promise<boolean>;
  verifyStaffPin: (pin: string) => Promise<boolean>;
  loginWithCredentials: (input: { role: "owner" | "staff"; userId: string; password: string; pin: string }) => Promise<{ ok: true; slug: string; cafeName: string } | { ok: false; error: string }>;
  saveCafeCredentials: (body: Record<string, unknown>) => Promise<{ ok: true; ownerUser: string; staffUser: string } | { ok: false; error: string }>;
  loadCafeCredentials: () => Promise<{ ownerUser: string; staffUser: string } | null>;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Persist>(() => localDefaults());
  const [ready, setReady] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);
  const [cafeList, setCafeList] = useState<api.ApiCafeListItem[]>([]);
  const [ownerOk, setOwnerOk] = useState(false);
  const [staffOk, setStaffOk] = useState(false);
  const [ownerPin, setOwnerPin] = useState(OWNER_PIN);
  const [staffPin, setStaffPin] = useState(STAFF_PIN);
  const stateRef = useRef(state);
  stateRef.current = state;
  const apiOnlineRef = useRef(apiOnline);
  apiOnlineRef.current = apiOnline;
  const ownerPinRef = useRef(ownerPin);
  ownerPinRef.current = ownerPin;
  const staffPinRef = useRef(staffPin);
  staffPinRef.current = staffPin;
  const ownerOkRef = useRef(ownerOk);
  ownerOkRef.current = ownerOk;
  const staffOkRef = useRef(staffOk);
  staffOkRef.current = staffOk;

  const applyCafePayload = useCallback(
    (slug: string, cafe: CafeProfile, categories: MenuCategory[], items: MenuItem[], keepOrders = false) => {
      setState((s) => ({
        ...s,
        cafeSlug: slug,
        cafe,
        categories,
        items,
        cart: s.cafeSlug === slug ? s.cart : [],
        cartTable: s.cafeSlug === slug ? s.cartTable : null,
        orders: keepOrders ? s.orders : s.cafeSlug === slug ? s.orders : [],
      }));
    },
    [],
  );

  const loadCafe = useCallback(
    async (slug: string) => {
      const online = await api.healthCheck();
      setApiOnline(online);
      if (online) {
        try {
          const data = await api.getCafe(slug);
          applyCafePayload(
            slug,
            mapApiCafe(data.cafe),
            data.categories,
            data.items.map(mapApiItem),
            false,
          );
          return;
        } catch (e) {
          console.warn("[cafeqred] loadCafe API failed", e);
        }
      }
      // offline / missing: velvet-bean local seed only
      if (slug === DEFAULT_SLUG || slug === demoCafe.slug) {
        const d = localDefaults(DEFAULT_SLUG);
        applyCafePayload(DEFAULT_SLUG, d.cafe, d.categories, d.items, false);
        setState((s) => ({ ...s, orders: demoOrders() }));
      } else {
        // keep trying local empty shell so UI doesn't crash
        applyCafePayload(
          slug,
          {
            slug,
            name: slug,
            tagline: "Offline — start the API on :8787",
            accentColor: "#E8B62C",
            hours: "",
            address: "",
            tableCount: 8,
            cashOnly: true,
            currency: "USD",
            country: "US",
            taxName: "Tax",
            taxRate: 0.08,
            altMilkPrice: 0.5,
            extraShotPrice: 0.75,
            orderingEnabled: true,
            headerMessages: [],
            guestStatusEnabled: false,
            lastCallEnabled: false,
            lastCallMessage: "",
            lastCallEndsAt: null,
          },
          [],
          [],
          false,
        );
      }
    },
    [applyCafePayload],
  );

  /** Owner/staff builds: after auth, only the session cafe — never a multi-cafe picker list. */
  const scopeListToSession = useCallback((list: api.ApiCafeListItem[], slug?: string) => {
    if (APP_ROLE === "customer") return list;
    if (!(ownerOkRef.current || staffOkRef.current)) return list;
    const s = (slug || stateRef.current.cafeSlug || "").trim();
    if (!s) return list;
    const hit = list.filter((c) => c.slug === s);
    if (hit.length) return hit;
    // Never empty the list after login (missed slug / race) — keep a session stub so ownerOk stays usable.
    const cafe = stateRef.current.cafe;
    return [
      {
        slug: s,
        name: cafe?.name || s,
        tagline: cafe?.tagline || "",
        currency: cafe?.currency,
        country: cafe?.country,
        taxName: cafe?.taxName,
        taxRate: cafe?.taxRate,
        accentColor: cafe?.accentColor,
      },
    ];
  }, []);

  const refreshCafeList = useCallback(async () => {
    const online = await api.healthCheck();
    setApiOnline(online);
    if (!online) {
      const fallback = [
        { slug: "velvet-bean", name: demoCafe.name, tagline: demoCafe.tagline, currency: "USD" },
      ];
      setCafeList(scopeListToSession(fallback));
      return;
    }
    try {
      const list = await api.listCafes();
      setCafeList(scopeListToSession(list));
    } catch {
      const fallback = [
        { slug: "velvet-bean", name: demoCafe.name, tagline: demoCafe.tagline, currency: "USD" },
      ];
      setCafeList(scopeListToSession(fallback));
    }
  }, [scopeListToSession]);

  const refreshOrders = useCallback(async () => {
    const s = stateRef.current;
    if (!apiOnlineRef.current) return;
    try {
      const rows = await api.listOrders(s.cafeSlug, staffPinRef.current);
      setState((prev) => ({ ...prev, orders: rows.map(mapApiOrder) }));
    } catch (e) {
      console.warn("[cafeqred] refreshOrders failed", e);
    }
  }, []);

  useEffect(() => {
    (async () => {
      let savedSlug = DEFAULT_SLUG;
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<Persist> & { cafe?: CafeProfile };
          savedSlug = parsed.cafeSlug || parsed.cafe?.slug || DEFAULT_SLUG;
          // Never restore cafe profile / menu from AsyncStorage — API loadCafe is source of truth
          // for name and other profile fields (avoids stale cafe.name winning after owner rename).
          setState((s) => ({
            ...s,
            guest: { ...emptyGuest, ...(parsed.guest || {}) },
            cart: parsed.cart || [],
            cartTable: parsed.cartTable ?? null,
            cafeSlug: savedSlug,
          }));
        }
      } catch {
        // ignore
      }
      await refreshCafeList();
      await loadCafe(savedSlug);
      setReady(true);
    })();
  }, [loadCafe, refreshCafeList]);

  useEffect(() => {
    if (!ready) return;
    const slim = {
      cafeSlug: state.cafeSlug,
      guest: state.guest,
      cart: state.cart,
      cartTable: state.cartTable,
    };
    AsyncStorage.setItem(KEY, JSON.stringify(slim)).catch(() => {});
  }, [state.cafeSlug, state.guest, state.cart, state.cartTable, ready]);

  const patch = useCallback((fn: (s: Persist) => Persist) => {
    setState((s) => fn(s));
  }, []);

  const renameTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const mergeCafeListEntry = useCallback((slug: string, cafe: CafeProfile) => {
    setCafeList((list) => {
      const entry = {
        slug: cafe.slug || slug,
        name: cafe.name,
        tagline: cafe.tagline,
        currency: cafe.currency,
        country: cafe.country,
        taxName: cafe.taxName,
        taxRate: cafe.taxRate,
        accentColor: cafe.accentColor,
      };
      // Staff/owner session: keep only the logged-in cafe in the list
      if (APP_ROLE !== "customer" && (ownerOkRef.current || staffOkRef.current)) {
        return [entry];
      }
      if (!list.length) return [entry];
      let found = false;
      const next = list.map((c) => {
        if (c.slug !== slug) return c;
        found = true;
        return { ...c, ...entry };
      });
      return found ? next : [...next, entry];
    });
  }, []);

  const saveCafe = useCallback(
    async (p: Partial<CafeProfile>): Promise<StoreResult> => {
      const s = stateRef.current;
      const next = { ...s.cafe, ...p };
      // Optimistic: profile + cafe list (landing / switchers) so rename shows everywhere immediately
      setState((prev) => ({ ...prev, cafe: next }));
      mergeCafeListEntry(s.cafeSlug, next);
      if (apiOnlineRef.current) {
        try {
          const updated = (await api.patchCafe(s.cafeSlug, p, ownerPinRef.current)) as api.ApiCafe;
          if (updated && typeof updated === "object" && updated.name) {
            const mapped = mapApiCafe(updated);
            setState((prev) => ({ ...prev, cafe: { ...prev.cafe, ...mapped } }));
            mergeCafeListEntry(s.cafeSlug, mapped);
          }
          // Quick refresh so list order / other sessions' fields stay authoritative
          await refreshCafeList();
          return { ok: true };
        } catch (e) {
          console.warn("[cafeqred] saveCafe API failed", e);
          try {
            await loadCafe(s.cafeSlug);
            await refreshCafeList();
          } catch {
            /* ignore */
          }
          return { ok: false, error: errMsg(e, "Could not save café profile") };
        }
      }
      return { ok: true };
    },
    [loadCafe, mergeCafeListEntry, refreshCafeList],
  );

  const addCategory = useCallback(async (name: string): Promise<StoreResult> => {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: "Category name is required" };
    const s = stateRef.current;
    if (apiOnlineRef.current) {
      try {
        const cat = (await api.postCategory(s.cafeSlug, trimmed, ownerPinRef.current)) as MenuCategory;
        setState((prev) => ({ ...prev, categories: [...prev.categories, cat] }));
        return { ok: true };
      } catch (e) {
        console.warn(e);
        return { ok: false, error: errMsg(e, "Could not add category") };
      }
    }
    patch((prev) => ({
      ...prev,
      categories: [
        ...prev.categories,
        { id: nid("cat"), name: trimmed, sort: prev.categories.length + 1 },
      ],
    }));
    return { ok: true };
  }, [patch]);

  const renameCategory = useCallback(
    async (id: string, name: string, opts?: { immediate?: boolean }): Promise<StoreResult> => {
      const trimmed = name;
      patch((s) => ({
        ...s,
        categories: s.categories.map((c) => (c.id === id ? { ...c, name: trimmed } : c)),
      }));
      if (!apiOnlineRef.current) return { ok: true };

      const flush = async (): Promise<StoreResult> => {
        try {
          await api.patchCategory(
            stateRef.current.cafeSlug,
            id,
            { name: trimmed.trim() || "Category" },
            ownerPinRef.current,
          );
          return { ok: true };
        } catch (e) {
          console.warn(e);
          return { ok: false, error: errMsg(e, "Could not rename category") };
        }
      };

      if (opts?.immediate) {
        const prev = renameTimers.current[id];
        if (prev) clearTimeout(prev);
        delete renameTimers.current[id];
        // Wait for flush — do not claim ok before API confirms
        return flush();
      }

      const prev = renameTimers.current[id];
      if (prev) clearTimeout(prev);
      // Debounced path: UI already updated; callers using immediate:true wait for flush.
      renameTimers.current[id] = setTimeout(() => {
        void flush();
        delete renameTimers.current[id];
      }, 450);
      return { ok: true };
    },
    [patch],
  );

  const deleteCategory = useCallback(
    async (id: string): Promise<StoreResult> => {
      const snap = stateRef.current;
      const removedCats = snap.categories.filter((c) => c.id === id);
      const removedItems = snap.items.filter((i) => i.categoryId === id);
      patch((s) => ({
        ...s,
        categories: s.categories.filter((c) => c.id !== id),
        items: s.items.filter((i) => i.categoryId !== id),
      }));
      if (apiOnlineRef.current) {
        try {
          await api.deleteCategory(stateRef.current.cafeSlug, id, ownerPinRef.current);
          return { ok: true };
        } catch (e) {
          console.warn(e);
          // restore on failure
          setState((s) => ({
            ...s,
            categories: [...s.categories, ...removedCats].sort((a, b) => a.sort - b.sort),
            items: [...s.items, ...removedItems],
          }));
          return { ok: false, error: errMsg(e, "Could not delete category") };
        }
      }
      return { ok: true };
    },
    [patch],
  );

  const upsertItem = useCallback(
    async (item: MenuItem): Promise<StoreResult> => {
      if (!item.name.trim()) return { ok: false, error: "Item name is required" };
      if (!item.categoryId) return { ok: false, error: "Pick a category" };
      const price = Number(item.price);
      if (!Number.isFinite(price) || price < 0) return { ok: false, error: "Enter a valid price" };
      const prep = Number(item.prepMinutes);
      if (!Number.isFinite(prep) || prep < 0) return { ok: false, error: "Enter valid prep minutes" };
      const clean: MenuItem = {
        id: item.id,
        categoryId: item.categoryId,
        name: item.name.trim(),
        description: item.description || "",
        price,
        prepMinutes: prep || 5,
        image: (item.image || "").trim(),
        tags: Array.isArray(item.tags) ? item.tags : [],
        hasMilk: !!item.hasMilk,
        hasExtraShot: !!item.hasExtraShot,
        modifiers: Array.isArray(item.modifiers) ? item.modifiers : [],
        available: item.available !== false,
      };
      const s = stateRef.current;
      const exists = s.items.some((i) => i.id === clean.id);
      // optimistic
      patch((prev) => ({
        ...prev,
        items: exists ? prev.items.map((i) => (i.id === clean.id ? clean : i)) : [...prev.items, clean],
      }));
      if (apiOnlineRef.current) {
        try {
          if (exists) {
            const updated = await api.patchItem(s.cafeSlug, clean.id, { ...clean }, ownerPinRef.current);
            const mapped = mapApiItem(updated as any);
            setState((prev) => ({
              ...prev,
              items: prev.items.map((i) => (i.id === clean.id ? mapped : i)),
            }));
          } else {
            const created = await api.postItem(s.cafeSlug, { ...clean }, ownerPinRef.current);
            const mapped = mapApiItem(created as any);
            setState((prev) => ({
              ...prev,
              items: prev.items.some((i) => i.id === clean.id)
                ? prev.items.map((i) => (i.id === clean.id ? mapped : i))
                : [...prev.items.filter((i) => i.id !== clean.id), mapped],
            }));
          }
          return { ok: true };
        } catch (e) {
          console.warn(e);
          // reload to avoid stale optimistic state
          try {
            await loadCafe(s.cafeSlug);
          } catch {
            /* ignore */
          }
          return { ok: false, error: errMsg(e, "Could not save item") };
        }
      }
      return { ok: true };
    },
    [patch, loadCafe],
  );

  const deleteItem = useCallback(
    async (id: string): Promise<StoreResult> => {
      const snap = stateRef.current;
      const removed = snap.items.find((i) => i.id === id);
      patch((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) }));
      if (apiOnlineRef.current) {
        try {
          await api.deleteItem(stateRef.current.cafeSlug, id, ownerPinRef.current);
          return { ok: true };
        } catch (e) {
          console.warn(e);
          if (removed) {
            setState((s) => ({ ...s, items: [...s.items, removed] }));
          }
          return { ok: false, error: errMsg(e, "Could not delete item") };
        }
      }
      return { ok: true };
    },
    [patch],
  );

  const restoreDemo = useCallback(async (): Promise<StoreResult> => {
    const slug = stateRef.current.cafeSlug || DEFAULT_SLUG;
    if (apiOnlineRef.current) {
      try {
        const data = await api.restoreDemoCafe(slug, ownerPinRef.current);
        applyCafePayload(
          slug,
          mapApiCafe(data.cafe),
          data.categories,
          data.items.map(mapApiItem),
          false,
        );
        setState((s) => ({ ...s, orders: [] }));
        return { ok: true };
      } catch (e) {
        console.warn(e);
        return { ok: false, error: errMsg(e, "Could not restore demo menu") };
      }
    }
    const d = localDefaults(DEFAULT_SLUG);
    applyCafePayload(DEFAULT_SLUG, d.cafe, d.categories, d.items, false);
    setState((s) => ({ ...s, orders: demoOrders() }));
    return { ok: true };
  }, [applyCafePayload]);

  const markWelcomed = useCallback(
    (table: string) =>
      patch((s) => {
        if (s.guest.welcomedTables.includes(table)) return s;
        return { ...s, guest: { ...s.guest, welcomedTables: [...s.guest.welcomedTables, table] } };
      }),
    [patch],
  );

  const setGuest = useCallback(
    (g: Partial<GuestSession>) => patch((s) => ({ ...s, guest: { ...s.guest, ...g } })),
    [patch],
  );

  const addToCart = useCallback(
    (itemId: string, opts?: { milk?: MilkOption | string; extraShot?: boolean; selections?: ModifierSelection[] }, table?: string) =>
      patch((s) => {
        let cart = s.cart;
        let cartTable = s.cartTable;
        if (table && cartTable && cartTable !== table) cart = [];
        if (table) cartTable = table;
        const selKey = selectionsKey(opts?.selections);
        const match = cart.find(
          (l) =>
            l.itemId === itemId &&
            selectionsKey(l.selections) === selKey &&
            l.milk === opts?.milk &&
            Boolean(l.extraShot) === Boolean(opts?.extraShot),
        );
        if (match) {
          return {
            ...s,
            cartTable,
            cart: cart.map((l) => (l.lineId === match.lineId ? { ...l, qty: l.qty + 1 } : l)),
          };
        }
        return {
          ...s,
          cartTable,
          cart: [
            ...cart,
            {
              lineId: nid("ln"),
              itemId,
              qty: 1,
              milk: opts?.milk as MilkOption | undefined,
              extraShot: opts?.extraShot,
              selections: opts?.selections,
            },
          ],
        };
      }),
    [patch],
  );

  const setQty = useCallback(
    (lineId: string, qty: number) =>
      patch((s) => ({
        ...s,
        cart:
          qty <= 0
            ? s.cart.filter((l) => l.lineId !== lineId)
            : s.cart.map((l) => (l.lineId === lineId ? { ...l, qty } : l)),
      })),
    [patch],
  );

  const removeLine = useCallback(
    (lineId: string) => patch((s) => ({ ...s, cart: s.cart.filter((l) => l.lineId !== lineId) })),
    [patch],
  );

  const clearCart = useCallback(() => patch((s) => ({ ...s, cart: [], cartTable: null })), [patch]);

  const placeOrder = useCallback(
    async (input: {
      table: string;
      guestName: string;
      phone: string;
      notes: string;
      diningOption?: DiningOption;
    }) => {
      const s = stateRef.current;
      if (!s.cart.length) return null;
      if (s.cafe.orderingEnabled === false) return null;
      if (
        s.cafe.lastCallEnabled &&
        s.cafe.lastCallEndsAt &&
        Number(s.cafe.lastCallEndsAt) <= Date.now()
      ) {
        return null;
      }
      // Drop sold-out lines
      const sellable = s.cart.filter((line) => {
        const item = s.items.find((i) => i.id === line.itemId);
        return item && item.available !== false;
      });
      if (!sellable.length) return null;
      const totals = cartTotals(sellable, s.items, s.cafe);
      const items = sellable
        .map((line) => {
          const item = s.items.find((i) => i.id === line.itemId);
          if (!item) return null;
          return {
            itemId: item.id,
            name: item.name,
            qty: line.qty,
            unitPrice: lineUnitPrice(item, { milk: line.milk, extraShot: line.extraShot, selections: line.selections }, undefined, s.cafe),
            milk: line.milk,
            extraShot: line.extraShot,
            selections: line.selections,
          };
        })
        .filter(Boolean) as Order["items"];

      const diningOption: DiningOption = input.diningOption === "takeaway" ? "takeaway" : "dine_in";
      const confirmCode = genConfirmCode();

      const localOrder: Order = {
        id: orderCode(orderPrefixFromSlug(s.cafeSlug)),
        table: input.table,
        guestName: input.guestName.trim() || "Guest",
        phone: input.phone.trim(),
        notes: input.notes.trim(),
        items,
        subtotal: totals.subtotal,
        tax: totals.tax,
        taxName: s.cafe.taxName || totals.taxName,
        total: totals.total,
        status: "new",
        createdAt: Date.now(),
        estimatedWait: Math.max(4, totals.wait),
        payCash: s.cafe.cashOnly,
        confirmCode,
        diningOption,
      };

      if (apiOnlineRef.current) {
        try {
          const created = await api.placeOrderApi(s.cafeSlug, {
            table: input.table,
            guestName: localOrder.guestName,
            phone: localOrder.phone,
            notes: localOrder.notes,
            items,
            subtotal: localOrder.subtotal,
            tax: localOrder.tax,
            total: localOrder.total,
            estimatedWait: localOrder.estimatedWait,
            confirmCode,
            diningOption,
          });
          const order = mapApiOrder(created);
          setState({
            ...s,
            cart: [],
            guest: {
              ...s.guest,
              name: input.guestName.trim() || s.guest.name,
              phone: input.phone.trim() || s.guest.phone,
            },
            orders: [order, ...s.orders],
          });
          return order;
        } catch (e) {
          console.warn("[cafeqred] placeOrder API failed", e);
          throw e;
        }
      }

      setState({
        ...s,
        cart: [],
        guest: {
          ...s.guest,
          name: input.guestName.trim() || s.guest.name,
          phone: input.phone.trim() || s.guest.phone,
        },
        orders: [localOrder, ...s.orders],
      });
      return localOrder;
    },
    [],
  );

  const setOrderStatus = useCallback(async (id: string, status: OrderStatus) => {
    const prevStatus = stateRef.current.orders.find((o) => o.id === id)?.status;
    patch((s) => ({
      ...s,
      orders: s.orders.map((o) => (o.id === id ? { ...o, status } : o)),
    }));
    if (apiOnlineRef.current) {
      try {
        await api.patchOrder(stateRef.current.cafeSlug, id, status, staffPinRef.current);
      } catch (e) {
        console.warn(e);
        if (prevStatus) {
          patch((s) => ({
            ...s,
            orders: s.orders.map((o) => (o.id === id ? { ...o, status: prevStatus } : o)),
          }));
        }
      }
    }
  }, [patch]);


  const fetchGuestOrder = useCallback(async (id: string, confirm?: string) => {
    try {
      const code = confirm || stateRef.current.orders.find((o) => o.id === id)?.confirmCode || "";
      const raw = await api.getOrder(stateRef.current.cafeSlug, id, { confirm: code || undefined });
      const order = mapApiOrder(raw);
      setState((s) => {
        const others = s.orders.filter((o) => o.id !== order.id);
        return { ...s, orders: [order, ...others] };
      });
      return { ok: true as const, order };
    } catch (e: any) {
      const status = typeof e?.status === "number" ? e.status : undefined;
      return { ok: false as const, error: errMsg(e, status === 401 ? "Confirm code required" : "Could not load order"), status };
    }
  }, []);

  const rejectOrder = useCallback(async (id: string) => {
    const prev = stateRef.current.orders.find((o) => o.id === id);
    patch((s) => ({
      ...s,
      orders: s.orders.map((o) => (o.id === id ? { ...o, status: "cancelled" as OrderStatus } : o)),
    }));
    if (apiOnlineRef.current) {
      try {
        await api.cancelOrderApi(stateRef.current.cafeSlug, id, { staffPin: staffPinRef.current });
      } catch (e) {
        console.warn(e);
        if (prev) {
          patch((s) => ({
            ...s,
            orders: s.orders.map((o) => (o.id === id ? { ...o, status: prev.status } : o)),
          }));
        }
      }
    }
  }, [patch]);

  const cancelGuestOrder = useCallback(async (id: string, confirm?: string) => {
    const prev = stateRef.current.orders.find((o) => o.id === id);
    const code = confirm || prev?.confirmCode || "";
    if (prev && prev.status !== "new" && prev.status !== "preparing") {
      return { ok: false as const, error: "Only new or preparing orders can be cancelled" };
    }
    patch((s) => ({
      ...s,
      orders: s.orders.map((o) => (o.id === id ? { ...o, status: "cancelled" as OrderStatus } : o)),
    }));
    if (apiOnlineRef.current) {
      try {
        await api.cancelOrderApi(stateRef.current.cafeSlug, id, { confirm: code || undefined });
        return { ok: true as const };
      } catch (e: any) {
        if (prev) {
          patch((s) => ({
            ...s,
            orders: s.orders.map((o) => (o.id === id ? { ...o, status: prev.status } : o)),
          }));
        }
        return { ok: false as const, error: errMsg(e, "Could not cancel order") };
      }
    }
    return { ok: true as const };
  }, [patch]);

  const verifyOwnerPin = useCallback(async (pin: string) => {
    if (apiOnlineRef.current) {
      try {
        const r = await api.verifyOwner(stateRef.current.cafeSlug, pin);
        if (r.ok) setOwnerPin(pin);
        return r.ok;
      } catch {
        return pin === OWNER_PIN;
      }
    }
    return pin === OWNER_PIN;
  }, []);

  const verifyStaffPin = useCallback(async (pin: string) => {
    if (apiOnlineRef.current) {
      try {
        const r = await api.verifyStaff(stateRef.current.cafeSlug, pin);
        if (r.ok) setStaffPin(pin);
        return r.ok;
      } catch {
        return pin === STAFF_PIN;
      }
    }
    return pin === STAFF_PIN;
  }, []);

  const loginWithCredentials = useCallback(
    async (input: { role: "owner" | "staff"; userId: string; password: string; pin: string }) => {
      try {
        if (!apiOnlineRef.current) {
          // Offline demo: cafe1/2/3 + pass + 1234 map to seeded slugs
          const map: Record<string, string> = {
            cafe1: "velvet-bean",
            cafe2: "spice-lane",
            cafe3: "himalayan-beans",
          };
          const slug = map[input.userId.trim().toLowerCase()];
          if (!slug || input.password !== "pass" || input.pin !== "1234") {
            return { ok: false as const, error: "Invalid login (offline demo needs cafe1–3 / pass / 1234)" };
          }
          await loadCafe(slug);
          if (input.role === "owner") {
            setOwnerPin(input.pin);
            setOwnerOk(true);
            ownerOkRef.current = true;
          } else {
            setStaffPin(input.pin);
            setStaffOk(true);
            staffOkRef.current = true;
          }
          const cafeName = stateRef.current.cafe?.name || slug;
          setCafeList([
            {
              slug,
              name: cafeName,
              tagline: stateRef.current.cafe?.tagline,
              currency: stateRef.current.cafe?.currency,
              country: stateRef.current.cafe?.country,
              taxName: stateRef.current.cafe?.taxName,
              taxRate: stateRef.current.cafe?.taxRate,
              accentColor: stateRef.current.cafe?.accentColor,
            },
          ]);
          return { ok: true as const, slug, cafeName };
        }
        const r = await api.loginCafe(input);
        if (!r.ok) return { ok: false as const, error: "Invalid login" };
        await loadCafe(r.slug);
        if (input.role === "owner") {
          setOwnerPin(input.pin);
          setOwnerOk(true);
          ownerOkRef.current = true;
        } else {
          setStaffPin(input.pin);
          setStaffOk(true);
          staffOkRef.current = true;
        }
        setCafeList([
          {
            slug: r.slug,
            name: r.cafeName || stateRef.current.cafe?.name || r.slug,
            tagline: stateRef.current.cafe?.tagline,
            currency: stateRef.current.cafe?.currency,
            country: stateRef.current.cafe?.country,
            taxName: stateRef.current.cafe?.taxName,
            taxRate: stateRef.current.cafe?.taxRate,
            accentColor: stateRef.current.cafe?.accentColor,
          },
        ]);
        return { ok: true as const, slug: r.slug, cafeName: r.cafeName };
      } catch (e: any) {
        return { ok: false as const, error: errMsg(e, "Login failed") };
      }
    },
    [loadCafe, setOwnerOk, setStaffOk, setOwnerPin, setStaffPin],
  );

  const saveCafeCredentials = useCallback(
    async (body: Record<string, unknown>) => {
      try {
        const r = await api.saveCredentials(stateRef.current.cafeSlug, body, ownerPinRef.current);
        return { ok: true as const, ownerUser: r.ownerUser, staffUser: r.staffUser };
      } catch (e: any) {
        return { ok: false as const, error: errMsg(e, "Could not save credentials") };
      }
    },
    [],
  );

  const loadCafeCredentials = useCallback(async () => {
    try {
      return await api.getCredentials(stateRef.current.cafeSlug, ownerPinRef.current);
    } catch {
      return null;
    }
  }, []);

  const value = useMemo<Store>(
    () => ({
      ...state,
      ready,
      apiOnline,
      cafeList,
      ownerOk,
      staffOk,
      ownerPin,
      staffPin,
      setOwnerOk,
      setStaffOk,
      setOwnerPin,
      setStaffPin,
      loadCafe,
      refreshOrders,
      refreshCafeList,
      saveCafe,
      addCategory,
      renameCategory,
      deleteCategory,
      upsertItem,
      deleteItem,
      restoreDemo,
      markWelcomed,
      setGuest,
      addToCart,
      setQty,
      removeLine,
      clearCart,
      placeOrder,
      setOrderStatus,
      fetchGuestOrder,
      rejectOrder,
      cancelGuestOrder,
      verifyOwnerPin,
      verifyStaffPin,
      loginWithCredentials,
      saveCafeCredentials,
      loadCafeCredentials,
    }),
    [
      state,
      ready,
      apiOnline,
      cafeList,
      ownerOk,
      staffOk,
      ownerPin,
      staffPin,
      loadCafe,
      refreshOrders,
      refreshCafeList,
      saveCafe,
      addCategory,
      renameCategory,
      deleteCategory,
      upsertItem,
      deleteItem,
      restoreDemo,
      markWelcomed,
      setGuest,
      addToCart,
      setQty,
      removeLine,
      clearCart,
      placeOrder,
      setOrderStatus,
      fetchGuestOrder,
      rejectOrder,
      cancelGuestOrder,
      verifyOwnerPin,
      verifyStaffPin,
      loginWithCredentials,
      saveCafeCredentials,
      loadCafeCredentials,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside provider");
  return s;
}

export function emptyItem(categoryId: string): MenuItem {
  return {
    id: nid("item"),
    categoryId,
    name: "",
    description: "",
    price: 0,
    prepMinutes: 5,
    tags: [] as DietaryTag[],
    image:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80",
    hasMilk: false,
    hasExtraShot: false,
    modifiers: [],
    available: true,
  };
}
