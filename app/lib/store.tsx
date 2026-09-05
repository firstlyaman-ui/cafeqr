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
import { cartTotals, lineUnitPrice, nid, orderCode, orderPrefixFromSlug } from "./format";
import { demoCafe, demoCategories, demoItems, demoOrders } from "./seed";
import type {
  CafeProfile,
  CartLine,
  DietaryTag,
  GuestSession,
  MenuCategory,
  MenuItem,
  MilkOption,
  Order,
  OrderStatus,
} from "./types";
import { OWNER_PIN, STAFF_PIN } from "./types";

export type StoreResult = { ok: true } | { ok: false; error: string };

function errMsg(e: unknown, fallback = "Request failed"): string {
  if (e && typeof e === "object" && "message" in e && typeof (e as any).message === "string") {
    return (e as any).message || fallback;
  }
  return fallback;
}

const KEY = "cafeqr-v2";
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
    items: demoItems.map((i) => ({ ...i, tags: [...i.tags] as DietaryTag[] })),
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
}): CafeProfile {
  return {
    slug: c.slug,
    name: c.name,
    tagline: c.tagline,
    accentColor: c.accentColor,
    hours: c.hours,
    address: c.address,
    tableCount: c.tableCount,
    cashOnly: c.cashOnly,
    currency: (c.currency === "INR" ? "INR" : "USD") as CafeProfile["currency"],
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
  addToCart: (itemId: string, opts?: { milk?: MilkOption; extraShot?: boolean }, table?: string) => void;
  setQty: (lineId: string, qty: number) => void;
  removeLine: (lineId: string) => void;
  clearCart: () => void;
  placeOrder: (input: {
    table: string;
    guestName: string;
    phone: string;
    notes: string;
  }) => Promise<Order | null>;
  setOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
  verifyOwnerPin: (pin: string) => Promise<boolean>;
  verifyStaffPin: (pin: string) => Promise<boolean>;
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
          console.warn("[cafeqr] loadCafe API failed", e);
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
          },
          [],
          [],
          false,
        );
      }
    },
    [applyCafePayload],
  );

  const refreshCafeList = useCallback(async () => {
    const online = await api.healthCheck();
    setApiOnline(online);
    if (!online) {
      setCafeList([
        { slug: "velvet-bean", name: demoCafe.name, tagline: demoCafe.tagline, currency: "USD" },
      ]);
      return;
    }
    try {
      const list = await api.listCafes();
      setCafeList(list);
    } catch {
      setCafeList([
        { slug: "velvet-bean", name: demoCafe.name, tagline: demoCafe.tagline, currency: "USD" },
      ]);
    }
  }, []);

  const refreshOrders = useCallback(async () => {
    const s = stateRef.current;
    if (!apiOnlineRef.current) return;
    try {
      const rows = await api.listOrders(s.cafeSlug, staffPinRef.current);
      setState((prev) => ({ ...prev, orders: rows.map(mapApiOrder) }));
    } catch (e) {
      console.warn("[cafeqr] refreshOrders failed", e);
    }
  }, []);

  useEffect(() => {
    (async () => {
      let savedSlug = DEFAULT_SLUG;
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<Persist>;
          savedSlug = parsed.cafeSlug || DEFAULT_SLUG;
          setState((s) => ({
            ...s,
            guest: { ...emptyGuest, ...(parsed.guest || {}) },
            cart: parsed.cart || [],
            cartTable: parsed.cartTable ?? null,
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

  const saveCafe = useCallback(
    async (p: Partial<CafeProfile>): Promise<StoreResult> => {
      const s = stateRef.current;
      const next = { ...s.cafe, ...p };
      setState((prev) => ({ ...prev, cafe: next }));
      if (apiOnlineRef.current) {
        try {
          await api.patchCafe(s.cafeSlug, p, ownerPinRef.current);
          return { ok: true };
        } catch (e) {
          console.warn("[cafeqr] saveCafe API failed", e);
          return { ok: false, error: errMsg(e, "Could not save café profile") };
        }
      }
      return { ok: true };
    },
    [],
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
        return flush();
      }

      const prev = renameTimers.current[id];
      if (prev) clearTimeout(prev);
      // Debounce API writes while typing; resolve immediately so callers are not hung.
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
    (itemId: string, opts?: { milk?: MilkOption; extraShot?: boolean }, table?: string) =>
      patch((s) => {
        let cart = s.cart;
        let cartTable = s.cartTable;
        if (table && cartTable && cartTable !== table) cart = [];
        if (table) cartTable = table;
        const match = cart.find(
          (l) =>
            l.itemId === itemId &&
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
              milk: opts?.milk,
              extraShot: opts?.extraShot,
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
    async (input: { table: string; guestName: string; phone: string; notes: string }) => {
      const s = stateRef.current;
      if (!s.cart.length) return null;
      const totals = cartTotals(s.cart, s.items, s.cafe.currency);
      const items = s.cart
        .map((line) => {
          const item = s.items.find((i) => i.id === line.itemId);
          if (!item) return null;
          return {
            itemId: item.id,
            name: item.name,
            qty: line.qty,
            unitPrice: lineUnitPrice(item, line.milk, line.extraShot),
            milk: line.milk,
            extraShot: line.extraShot,
          };
        })
        .filter(Boolean) as Order["items"];

      const localOrder: Order = {
        id: orderCode(orderPrefixFromSlug(s.cafeSlug)),
        table: input.table,
        guestName: input.guestName.trim() || "Guest",
        phone: input.phone.trim(),
        notes: input.notes.trim(),
        items,
        subtotal: totals.subtotal,
        tax: s.cafe.currency === "INR" ? 0 : totals.tax,
        total: s.cafe.currency === "INR" ? totals.subtotal : totals.total,
        status: "new",
        createdAt: Date.now(),
        estimatedWait: Math.max(4, totals.wait),
        payCash: s.cafe.cashOnly,
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
          console.warn("[cafeqr] placeOrder API failed, using local", e);
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
    patch((s) => ({
      ...s,
      orders: s.orders.map((o) => (o.id === id ? { ...o, status } : o)),
    }));
    if (apiOnlineRef.current) {
      try {
        await api.patchOrder(stateRef.current.cafeSlug, id, status, staffPinRef.current);
      } catch (e) {
        console.warn(e);
      }
    }
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
      verifyOwnerPin,
      verifyStaffPin,
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
      verifyOwnerPin,
      verifyStaffPin,
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
  };
}
