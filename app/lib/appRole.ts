/** Build-time app role for the three CafeQR web deployments. */

export type AppRole = "customer" | "staff" | "owner";

function env(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  const v = process.env?.[name]?.trim();
  return v || undefined;
}

function normalizeRole(raw: string | undefined): AppRole {
  const r = (raw || "customer").toLowerCase().replace(/_/g, "-");
  if (r === "staff" || r === "cafeqr-staff") return "staff";
  if (r === "owner" || r === "cafeqr-owner") return "owner";
  if (r === "customer" || r === "cafeqr" || r === "guest") return "customer";
  return "customer";
}

export const APP_ROLE: AppRole = normalizeRole(env("EXPO_PUBLIC_APP_ROLE"));

export const CUSTOMER_URL = (env("EXPO_PUBLIC_CUSTOMER_URL") || "https://cafeqr-five.vercel.app").replace(/\/$/, "");
export const STAFF_URL = (env("EXPO_PUBLIC_STAFF_URL") || "https://cafeqr-staff.vercel.app").replace(/\/$/, "");
export const OWNER_URL = (env("EXPO_PUBLIC_OWNER_URL") || "https://cafeqr-owner.vercel.app").replace(/\/$/, "");

export function isCustomerApp() {
  return APP_ROLE === "customer";
}
export function isStaffApp() {
  return APP_ROLE === "staff";
}
export function isOwnerApp() {
  return APP_ROLE === "owner";
}

/** Initial route for this role build. */
export function roleHomePath(): string {
  if (APP_ROLE === "staff") return "/staff";
  if (APP_ROLE === "owner") return "/owner";
  return "/";
}

/**
 * Path prefixes allowed in this role build.
 * Customer: guest flows only. Staff: board + QR. Owner: setup only.
 */
export function pathAllowedForRole(pathname: string): boolean {
  const p = pathname.split("?")[0] || "/";
  if (APP_ROLE === "customer") {
    if (p === "/owner" || p.startsWith("/owner/")) return false;
    if (p === "/staff" || p.startsWith("/staff/")) return false;
    return true;
  }
  if (APP_ROLE === "staff") {
    if (p === "/" || p === "/index" || p === "/staff" || p.startsWith("/staff/")) return true;
    return false;
  }
  // owner
  if (p === "/" || p === "/index" || p === "/owner" || p.startsWith("/owner/")) return true;
  return false;
}

export function staffBoardUrl(slug?: string) {
  const q = slug ? `?slug=${encodeURIComponent(slug)}` : "";
  return `${STAFF_URL}/staff${q}`;
}

export function ownerSetupUrl(slug?: string) {
  const q = slug ? `?slug=${encodeURIComponent(slug)}` : "";
  return `${OWNER_URL}/owner${q}`;
}

export function customerTableUrl(slug: string, table = "04") {
  const t = String(table).replace(/\D/g, "").padStart(2, "0") || "01";
  return `${CUSTOMER_URL}/c/${encodeURIComponent(slug)}/t/${t}`;
}

export function openExternal(url: string) {
  if (typeof window !== "undefined" && typeof window.open === "function") {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Linking = require("expo-linking");
    void Linking.openURL(url);
  } catch {
    // no-op
  }
}
