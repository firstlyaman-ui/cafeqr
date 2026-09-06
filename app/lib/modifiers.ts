import { surchargeDefaults, type CafeProfile, type MenuItem, type ModifierGroup, type ModifierSelection } from "./types";

export function parseModifiers(raw: unknown): ModifierGroup[] {
  if (!raw) return [];
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw || "[]");
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((g: any) => {
      if (!g || typeof g !== "object") return null;
      const id = String(g.id || "group");
      const options = Array.isArray(g.options)
        ? g.options
            .map((o: any) => {
              if (!o || typeof o !== "object") return null;
              const price = Number(o.price);
              return {
                id: String(o.id || "opt"),
                name: String(o.name || o.id || "Option"),
                price: Number.isFinite(price) && price >= 0 ? price : 0,
              };
            })
            .filter(Boolean)
        : [];
      const max = Number(g.max);
      return {
        id,
        name: String(g.name || id),
        required: !!g.required,
        max: Number.isFinite(max) && max > 0 ? Math.min(99, Math.floor(max)) : 1,
        options: options as ModifierGroup["options"],
      };
    })
    .filter(Boolean) as ModifierGroup[];
}

export function defaultMilkGroup(currency?: string): ModifierGroup {
  const { altMilk } = surchargeDefaults(currency);
  return {
    id: "milk",
    name: "Milk",
    required: false,
    max: 1,
    options: [
      { id: "whole", name: "Whole", price: 0 },
      { id: "oat", name: "Oat", price: altMilk },
      { id: "almond", name: "Almond", price: altMilk },
      { id: "skim", name: "Skim", price: 0 },
    ],
  };
}

export function defaultExtraShotGroup(currency?: string): ModifierGroup {
  const { extraShot } = surchargeDefaults(currency);
  return {
    id: "extra-shot",
    name: "Extra shot",
    required: false,
    max: 1,
    options: [{ id: "yes", name: "Extra shot", price: extraShot }],
  };
}

/** Effective modifiers for UI — structured first, else legacy flags. */
export function effectiveModifiers(
  item: Pick<MenuItem, "modifiers" | "hasMilk" | "hasExtraShot">,
  cafe?: Pick<CafeProfile, "currency" | "altMilkPrice" | "extraShotPrice">,
): ModifierGroup[] {
  const parsed = parseModifiers(item.modifiers);
  if (parsed.length) return parsed;
  const currency = cafe?.currency;
  const sur = surchargeDefaults(currency);
  const alt =
    cafe && Number.isFinite(Number(cafe.altMilkPrice)) ? Number(cafe.altMilkPrice) : sur.altMilk;
  const shot =
    cafe && Number.isFinite(Number(cafe.extraShotPrice)) ? Number(cafe.extraShotPrice) : sur.extraShot;
  const out: ModifierGroup[] = [];
  if (item.hasMilk) {
    out.push({
      id: "milk",
      name: "Milk",
      required: false,
      max: 1,
      options: [
        { id: "whole", name: "Whole", price: 0 },
        { id: "oat", name: "Oat", price: alt },
        { id: "almond", name: "Almond", price: alt },
        { id: "skim", name: "Skim", price: 0 },
      ],
    });
  }
  if (item.hasExtraShot) {
    out.push({
      id: "extra-shot",
      name: "Extra shot",
      required: false,
      max: 1,
      options: [{ id: "yes", name: "Extra shot", price: shot }],
    });
  }
  return out;
}

export function itemHasOptions(item: Pick<MenuItem, "modifiers" | "hasMilk" | "hasExtraShot">): boolean {
  return effectiveModifiers(item).length > 0;
}

export function selectionsKey(sels?: ModifierSelection[]): string {
  if (!sels?.length) return "";
  return sels
    .map((s) => `${s.groupId}:${s.optionId}`)
    .sort()
    .join("|");
}

export function priceWithSelections(
  basePrice: number,
  modifiers: ModifierGroup[],
  selections?: ModifierSelection[],
): number {
  let unit = Number(basePrice) || 0;
  for (const sel of selections || []) {
    const group = modifiers.find((g) => g.id === sel.groupId);
    const opt = group?.options.find((o) => o.id === sel.optionId);
    if (opt) unit += Number(opt.price) || 0;
  }
  return Math.round(unit * 100) / 100;
}

export function blurbFromSelections(
  modifiers: ModifierGroup[],
  selections: ModifierSelection[] | undefined,
  currency: string,
  moneyFn: (n: number, c?: string) => string,
): string {
  if (!selections?.length) return "";
  const bits: string[] = [];
  for (const sel of selections) {
    const group = modifiers.find((g) => g.id === sel.groupId);
    const opt = group?.options.find((o) => o.id === sel.optionId);
    if (!opt) continue;
    bits.push(opt.price ? `${opt.name} +${moneyFn(opt.price, currency)}` : opt.name);
  }
  return bits.join(" · ");
}

export function legacyFromSelections(selections?: ModifierSelection[]): {
  milk?: string;
  extraShot?: boolean;
} {
  let milk: string | undefined;
  let extraShot: boolean | undefined;
  for (const sel of selections || []) {
    if (sel.groupId === "milk") milk = sel.optionId;
    if (sel.groupId === "extra-shot") extraShot = true;
  }
  return { milk, extraShot };
}

export function nidShort(prefix = "mod"): string {
  return `${prefix}-${Date.now().toString(36).slice(-4)}-${Math.random().toString(36).slice(2, 6)}`;
}
