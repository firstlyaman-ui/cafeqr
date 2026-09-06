import { CUSTOMER_URL } from "./appRole";
const DEV_DEFAULT = "http://localhost:8787";
const PROD_DEFAULT = "https://cafeqr-api.vercel.app";

function resolveApiBase(): string {
  const fromEnv =
    typeof process !== "undefined" ? process.env?.EXPO_PUBLIC_API_URL?.trim() : undefined;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  // Expo production / static export: never bake localhost
  if (typeof __DEV__ !== "undefined" && __DEV__) return DEV_DEFAULT;
  return PROD_DEFAULT;
}

export const API_BASE = resolveApiBase();

export type ApiCafeListItem = {
  slug: string;
  name: string;
  tagline: string;
  currency?: string;
  country?: string;
  taxName?: string;
  taxRate?: number;
  accentColor?: string;
};

export type ApiCafe = {
  id?: number;
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
  updatedAt?: number;
};

export type ApiItem = {
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
  active?: boolean;
  available?: boolean;
};

export type ApiErrorBody = {
  error?: string | { code?: string; message?: string };
};

export class ApiError extends Error {
  status: number;
  code: string;
  data: unknown;

  constructor(message: string, opts: { status: number; code?: string; data?: unknown }) {
    super(message);
    this.name = "ApiError";
    this.status = opts.status;
    this.code = opts.code || "HTTP_ERROR";
    this.data = opts.data;
  }
}

function extractError(data: any, status: number): { message: string; code: string } {
  if (data && typeof data.error === "object" && data.error) {
    return {
      message: String(data.error.message || data.error.code || `HTTP ${status}`),
      code: String(data.error.code || "HTTP_ERROR"),
    };
  }
  if (data && typeof data.error === "string") {
    return { message: data.error, code: "HTTP_ERROR" };
  }
  return { message: `HTTP ${status}`, code: "HTTP_ERROR" };
}

const DEFAULT_TIMEOUT_MS = 12000;

async function req<T>(
  path: string,
  opts: RequestInit & {
    ownerPin?: string;
    staffPin?: string;
    adminToken?: string;
    timeoutMs?: number;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(opts.body ? { "Content-Type": "application/json" } : {}),
    ...(opts.headers as Record<string, string>),
  };
  if (opts.ownerPin) headers["X-Owner-Pin"] = opts.ownerPin;
  if (opts.staffPin) headers["X-Staff-Pin"] = opts.staffPin;
  if (opts.adminToken) headers["X-Admin-Token"] = opts.adminToken;
  const { ownerPin: _o, staffPin: _s, adminToken: _a, timeoutMs, ...rest } = opts;

  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const ms = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), ms) : null;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      cache: "no-store",
      ...rest,
      headers,
      signal: ctrl?.signal ?? rest.signal,
    });
  } catch (e: any) {
    if (timer) clearTimeout(timer);
    const aborted = e?.name === "AbortError";
    throw new ApiError(aborted ? "Request timed out — check your connection" : "Network error — API unreachable", {
      status: 0,
      code: aborted ? "TIMEOUT" : "NETWORK",
      data: e,
    });
  }
  if (timer) clearTimeout(timer);

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  if (!res.ok) {
    const { message, code } = extractError(data, res.status);
    throw new ApiError(message, { status: res.status, code, data });
  }
  return data as T;
}

export type HealthStatus = {
  ok: boolean;
  db?: "up" | "down";
  driver?: string;
  version?: string;
};

export async function healthCheck(): Promise<boolean> {
  try {
    const h = await getHealth();
    return !!h.ok;
  } catch {
    return false;
  }
}

export async function getHealth(): Promise<HealthStatus> {
  return req<HealthStatus>("/health", { timeoutMs: 4000 });
}

export function listCafes() {
  return req<ApiCafeListItem[]>("/cafes");
}

export function getCafe(slug: string) {
  return req<{
    cafe: ApiCafe;
    categories: { id: string; name: string; sort: number }[];
    items: ApiItem[];
  }>(`/cafes/${encodeURIComponent(slug)}`);
}

export function createCafe(body: Record<string, unknown>, adminToken?: string) {
  return req("/cafes", { method: "POST", body: JSON.stringify(body), adminToken });
}

export function patchCafe(slug: string, body: Record<string, unknown>, ownerPin: string) {
  return req<ApiCafe>(`/cafes/${encodeURIComponent(slug)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    ownerPin,
  });
}

export function verifyOwner(slug: string, pin: string) {
  return req<{ ok: boolean }>(`/cafes/${encodeURIComponent(slug)}/verify-owner`, {
    method: "POST",
    body: JSON.stringify({ pin }),
  });
}

export function verifyStaff(slug: string, pin: string) {
  return req<{ ok: boolean }>(`/cafes/${encodeURIComponent(slug)}/verify-staff`, {
    method: "POST",
    body: JSON.stringify({ pin }),
  });
}

export function loginCafe(body: { role: "owner" | "staff"; userId: string; password: string; pin: string }) {
  return req<{ ok: boolean; role: string; slug: string; cafeName: string; userId: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getCredentials(slug: string, ownerPin: string) {
  return req<{ ownerUser: string; staffUser: string }>(`/cafes/${encodeURIComponent(slug)}/credentials`, {
    ownerPin,
  });
}

export function saveCredentials(slug: string, body: Record<string, unknown>, ownerPin: string) {
  return req<{ ok: boolean; ownerUser: string; staffUser: string }>(
    `/cafes/${encodeURIComponent(slug)}/credentials`,
    {
      method: "POST",
      body: JSON.stringify(body),
      ownerPin,
    },
  );
}

export function postCategory(slug: string, name: string, ownerPin: string) {
  return req(`/cafes/${encodeURIComponent(slug)}/categories`, {
    method: "POST",
    body: JSON.stringify({ name }),
    ownerPin,
  });
}

export function patchCategory(slug: string, id: string, body: Record<string, unknown>, ownerPin: string) {
  return req(`/cafes/${encodeURIComponent(slug)}/categories/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    ownerPin,
  });
}

export function deleteCategory(slug: string, id: string, ownerPin: string) {
  return req(`/cafes/${encodeURIComponent(slug)}/categories/${encodeURIComponent(id)}`, {
    method: "DELETE",
    ownerPin,
  });
}

export function postItem(slug: string, body: Record<string, unknown>, ownerPin: string) {
  return req(`/cafes/${encodeURIComponent(slug)}/items`, {
    method: "POST",
    body: JSON.stringify(body),
    ownerPin,
  });
}

export function patchItem(slug: string, id: string, body: Record<string, unknown>, ownerPin: string) {
  return req(`/cafes/${encodeURIComponent(slug)}/items/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    ownerPin,
  });
}

export function deleteItem(slug: string, id: string, ownerPin: string) {
  return req(`/cafes/${encodeURIComponent(slug)}/items/${encodeURIComponent(id)}`, {
    method: "DELETE",
    ownerPin,
  });
}

export function restoreDemoCafe(slug: string, ownerPin: string) {
  return req<{
    ok: boolean;
    cafe: ApiCafe;
    categories: { id: string; name: string; sort: number }[];
    items: ApiItem[];
  }>(`/cafes/${encodeURIComponent(slug)}/restore-demo`, {
    method: "POST",
    body: JSON.stringify({}),
    ownerPin,
  });
}

export function listOrders(slug: string, staffPin: string) {
  return req<any[]>(`/cafes/${encodeURIComponent(slug)}/orders`, { staffPin });
}

export function placeOrderApi(slug: string, body: Record<string, unknown>) {
  return req<any>(`/cafes/${encodeURIComponent(slug)}/orders`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchOrder(slug: string, id: string, status: string, staffPin: string) {
  return req<any>(`/cafes/${encodeURIComponent(slug)}/orders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
    staffPin,
  });
}

/** Guest cancel (or staff) — status cancelled. Guest must pass confirm code. */
export function cancelOrderApi(
  slug: string,
  id: string,
  opts: { confirm?: string; staffPin?: string } = {},
) {
  return req<any>(`/cafes/${encodeURIComponent(slug)}/orders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "cancelled", confirm: opts.confirm || undefined }),
    staffPin: opts.staffPin,
  });
}

export function deleteOrder(slug: string, id: string, staffPin: string) {
  return req<{ ok: boolean }>(`/cafes/${encodeURIComponent(slug)}/orders/${encodeURIComponent(id)}`, {
    method: "DELETE",
    staffPin,
  });
}

export function getOrder(
  slug: string,
  id: string,
  opts: { confirm?: string; staffPin?: string } = {},
) {
  const q = opts.confirm ? `?confirm=${encodeURIComponent(opts.confirm)}` : "";
  return req<any>(`/cafes/${encodeURIComponent(slug)}/orders/${encodeURIComponent(id)}${q}`, {
    staffPin: opts.staffPin,
  });
}

export function guestPath(slug: string, table: string) {
  const t = String(table).replace(/\D/g, "").padStart(2, "0") || "01";
  return `/c/${slug}/t/${t}`;
}

/** Public web origin baked into printable QR payloads. */
export const PUBLIC_WEB_ORIGIN = CUSTOMER_URL;

export function tableUrlFor(slug: string, table: number | string) {
  const path = guestPath(slug, String(table));
  // Printed / shared QR codes must always open the customer app, never staff/owner origins.
  if (typeof window !== "undefined" && window.location?.origin) {
    const origin = window.location.origin.replace(/\/$/, "");
    if (/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(origin)) {
      return `${PUBLIC_WEB_ORIGIN}${path}`;
    }
    // If this build is already the customer app, same-origin is fine.
    if (origin === PUBLIC_WEB_ORIGIN || /cafeqr-five\.vercel\.app$/i.test(origin)) {
      return `${origin}${path}`;
    }
  }
  return `${PUBLIC_WEB_ORIGIN}${path}`;
}
