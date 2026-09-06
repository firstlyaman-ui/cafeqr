/** Optional Google product helpers for CafeQred (customer web first). */

import { Platform } from "react-native";

export const GOOGLE_CLIENT_ID =
  (typeof process !== "undefined" && process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID?.trim()) || "";

export const GA_ID =
  (typeof process !== "undefined" && process.env.EXPO_PUBLIC_GA_ID?.trim()) || "";

export function googleMapsUrl(address: string): string {
  const q = encodeURIComponent(String(address || "").trim());
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    google?: any;
  }
}

let gaBooted = false;

/** Inject GA4 only when EXPO_PUBLIC_GA_ID is set (web). */
export function ensureGa(): void {
  if (!GA_ID || typeof document === "undefined" || gaBooted) return;
  gaBooted = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID, { send_page_view: false });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(s);
}

export function trackPageview(path: string, title?: string): void {
  if (!GA_ID || typeof window === "undefined") return;
  ensureGa();
  try {
    window.gtag?.("event", "page_view", {
      page_path: path,
      page_title: title || path,
    });
  } catch {
    /* ignore */
  }
}

async function loadGis(): Promise<void> {
  if (typeof window === "undefined") throw new Error("Google Sign-In is web-only in this build");
  if (window.google?.accounts?.oauth2) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-cafeqred-gis="1"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("GIS load failed")));
      if (window.google?.accounts?.oauth2) resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.dataset.cafeqredGis = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Google Identity Services"));
    document.head.appendChild(s);
  });
}

async function signInWithGis(): Promise<
  | { ok: true; name: string; email: string; sub: string }
  | { ok: false; error: string }
> {
  await loadGis();
  const token = await new Promise<any>((resolve, reject) => {
    try {
      window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "openid profile email",
        prompt: "select_account",
        callback: (resp: any) => {
          if (resp?.error) reject(new Error(resp.error));
          else resolve(resp);
        },
        error_callback: (err: any) => reject(new Error(err?.message || "Google Sign-In cancelled")),
      }).requestAccessToken();
    } catch (e: any) {
      reject(e);
    }
  });
  const accessToken = token?.access_token;
  if (!accessToken) return { ok: false, error: "No access token from Google" };
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return { ok: false, error: "Could not load Google profile" };
  const profile = (await res.json()) as { name?: string; email?: string; sub?: string };
  return {
    ok: true,
    name: profile.name || "Guest",
    email: profile.email || "",
    sub: profile.sub || "",
  };
}

async function signInWithAuthSession(): Promise<
  | { ok: true; name: string; email: string; sub: string }
  | { ok: false; error: string }
> {
  const AuthSession = await import("expo-auth-session");
  const WebBrowser = await import("expo-web-browser");
  WebBrowser.maybeCompleteAuthSession();
  const redirectUri = AuthSession.makeRedirectUri();
  const discovery = {
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    revocationEndpoint: "https://oauth2.googleapis.com/revoke",
  };
  const request = new AuthSession.AuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    redirectUri,
    scopes: ["openid", "profile", "email"],
    responseType: AuthSession.ResponseType.Token,
    usePKCE: false,
    extraParams: { prompt: "select_account" },
  });
  await request.makeAuthUrlAsync(discovery);
  const result = await request.promptAsync(discovery);
  if (result.type !== "success") {
    return { ok: false, error: result.type === "dismiss" ? "Sign-in cancelled" : "Sign-in failed" };
  }
  const accessToken =
    (result as any).authentication?.accessToken || (result as any).params?.access_token || "";
  if (!accessToken) return { ok: false, error: "No access token from Google" };
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return { ok: false, error: "Could not load Google profile" };
  const profile = (await res.json()) as { name?: string; email?: string; sub?: string };
  return {
    ok: true,
    name: profile.name || "Guest",
    email: profile.email || "",
    sub: profile.sub || "",
  };
}

/**
 * Continue with Google. Guest path must always remain available.
 * Prefers Google Identity Services on web; falls back to AuthSession when installed.
 */
export async function signInWithGoogle(): Promise<
  | { ok: true; name: string; email: string; sub: string }
  | { ok: false; error: string; needsSetup?: boolean }
> {
  if (!GOOGLE_CLIENT_ID) {
    return {
      ok: false,
      needsSetup: true,
      error: "Add EXPO_PUBLIC_GOOGLE_CLIENT_ID (OAuth Web client) to enable Google Sign-In.",
    };
  }
  try {
    if (Platform.OS === "web") {
      try {
        return await signInWithGis();
      } catch (e: any) {
        // fall through to AuthSession if present
        try {
          return await signInWithAuthSession();
        } catch {
          return { ok: false, error: e?.message || "Google Sign-In failed" };
        }
      }
    }
    return await signInWithAuthSession();
  } catch (e: any) {
    return { ok: false, error: e?.message || "Google Sign-In unavailable" };
  }
}
