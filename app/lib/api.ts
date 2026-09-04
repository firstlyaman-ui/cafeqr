export const API_BASE =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
  "http://localhost:8787";

export type ApiCafeListItem = {
  slug: string;
  name: string;
  tagline: string;
  currency?: string;
  accentColor?: string;
};

async function req<T>(
  path: string,
  opts: RequestInit & { ownerPin?: string; staffPin?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(opts.body ? { "Content-Type": "application/json" } : {}),
    ...(opts.headers as Record<string, string>),
  };
  if (opts.ownerPin) headers["X-Owner-Pin"] = opts.ownerPin;
  if (opts.staffPin) headers["X-Staff-Pin"] = opts.staffPin;
  const { ownerPin: _o, staffPin: _s, ...rest } = opts;
  const res = await fetch(`${API_BASE}${path}`, { ...rest, headers });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || `HTTP ${res.status}`) as Error & {
      status?: number;
      data?: unknown;
    };
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

export async function healthCheck(): Promise<boolean> {
  try {
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const t = ctrl ? setTimeout(() => ctrl.abort(), 2500) : null;
    const r = await fetch(`${API_BASE}/health`, { signal: ctrl?.signal });
    if (t) clearTimeout(t);
    if (!r.ok) return false;
    const j = await r.json();
    return !!j.ok;
  } catch {
    return false;
  }
}

export function listCafes() {
  return req<ApiCafeListItem[]>("/cafes");
}

export function getCafe(slug: string) {
  return req<{
    cafe: {
      id: number;
      slug: string;
      name: string;
      tagline: string;
      accentColor: string;
      hours: string;
      address: string;
      tableCount: number;
      cashOnly: boolean;
      currency: string;
    };
    categories: { id: string; name: string; sort: number }[];
    items: {
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
    }[];
  }>(`/cafes/${encodeURIComponent(slug)}`);
}

export function createCafe(body: Record<string, unknown>) {
  return req("/cafes", { method: "POST", body: JSON.stringify(body) });
}

export function patchCafe(slug: string, body: Record<string, unknown>, ownerPin: string) {
  return req(`/cafes/${encodeURIComponent(slug)}`, {
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

export function guestPath(slug: string, table: string) {
  const t = String(table).replace(/\D/g, "").padStart(2, "0") || "01";
  return `/c/${slug}/t/${t}`;
}

export function tableUrlFor(slug: string, table: number | string) {
  const path = guestPath(slug, String(table));
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
}
