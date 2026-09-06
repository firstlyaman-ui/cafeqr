/** Structured item modifiers (milk, extra shot, custom groups). */

function defaultSurcharges(currency) {
  const c = String(currency || "USD").toUpperCase();
  if (c === "NPR") return { altMilk: 25, extraShot: 40 };
  if (c === "INR") return { altMilk: 20, extraShot: 30 };
  return { altMilk: 0.5, extraShot: 0.75 };
}

function slugify(name) {
  return String(name || "opt")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "opt";
}

function parseModifiers(raw) {
  if (!raw) return [];
  let arr = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw || "[]");
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((g) => {
      if (!g || typeof g !== "object") return null;
      const id = String(g.id || slugify(g.name) || "group").slice(0, 64);
      const name = String(g.name || id).slice(0, 80);
      const options = Array.isArray(g.options)
        ? g.options
            .map((o) => {
              if (!o || typeof o !== "object") return null;
              const oid = String(o.id || slugify(o.name) || "opt").slice(0, 64);
              const oname = String(o.name || oid).slice(0, 80);
              const price = Number(o.price);
              return {
                id: oid,
                name: oname,
                price: Number.isFinite(price) && price >= 0 ? price : 0,
              };
            })
            .filter(Boolean)
        : [];
      const maxRaw = Number(g.max);
      const max = Number.isFinite(maxRaw) && maxRaw > 0 ? Math.min(99, Math.floor(maxRaw)) : 1;
      return {
        id,
        name,
        required: !!g.required,
        max,
        options,
      };
    })
    .filter(Boolean);
}

function serializeModifiers(mods) {
  return JSON.stringify(parseModifiers(mods));
}

function defaultMilkGroup(currency) {
  const { altMilk } = defaultSurcharges(currency);
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

function defaultExtraShotGroup(currency) {
  const { extraShot } = defaultSurcharges(currency);
  return {
    id: "extra-shot",
    name: "Extra shot",
    required: false,
    max: 1,
    options: [{ id: "yes", name: "Extra shot", price: extraShot }],
  };
}

/** Build seed modifiers from legacy flags + cafe currency. */
function modifiersFromFlags(hasMilk, hasExtraShot, currency) {
  const out = [];
  if (hasMilk) out.push(defaultMilkGroup(currency));
  if (hasExtraShot) out.push(defaultExtraShotGroup(currency));
  return out;
}

function deriveFlagsFromModifiers(mods) {
  const list = parseModifiers(mods);
  const hasMilk = list.some((g) => g.id === "milk" || /milk/i.test(g.name));
  const hasExtraShot = list.some((g) => g.id === "extra-shot" || /extra\s*shot/i.test(g.name));
  return { has_milk: hasMilk ? 1 : 0, has_extra_shot: hasExtraShot ? 1 : 0 };
}

/** Legacy milk/extraShot → selection list when item has structured modifiers. */
function selectionsFromLegacy(line, modifiers) {
  const mods = parseModifiers(modifiers);
  const out = [];
  const milk = line?.milk ? String(line.milk) : "";
  if (milk) {
    const group = mods.find((g) => g.id === "milk") || mods.find((g) => /milk/i.test(g.name));
    if (group && group.options.some((o) => o.id === milk)) {
      out.push({ groupId: group.id, optionId: milk });
    }
  }
  if (line?.extraShot || line?.extra_shot) {
    const group =
      mods.find((g) => g.id === "extra-shot") || mods.find((g) => /extra\s*shot/i.test(g.name));
    if (group && group.options.length) {
      out.push({ groupId: group.id, optionId: group.options[0].id });
    }
  }
  return out;
}

function normalizeSelections(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => {
      if (!s || typeof s !== "object") return null;
      const groupId = String(s.groupId || s.group_id || "").slice(0, 64);
      const optionId = String(s.optionId || s.option_id || "").slice(0, 64);
      if (!groupId || !optionId) return null;
      return { groupId, optionId };
    })
    .filter(Boolean);
}

function resolveSelections(line, modifiers) {
  const mods = parseModifiers(modifiers);
  const explicit = normalizeSelections(line?.selections);
  if (explicit.length) return explicit;
  return selectionsFromLegacy(line, mods);
}

function priceFromModifiers(basePrice, modifiers, selections) {
  let unit = Number(basePrice) || 0;
  const mods = parseModifiers(modifiers);
  const sels = normalizeSelections(selections);
  for (const sel of sels) {
    const group = mods.find((g) => g.id === sel.groupId);
    if (!group) continue;
    const opt = group.options.find((o) => o.id === sel.optionId);
    if (opt) unit += Number(opt.price) || 0;
  }
  return unit;
}

/** Snapshot legacy milk / extraShot for order display when possible. */
function legacyFromSelections(selections, modifiers) {
  const mods = parseModifiers(modifiers);
  const sels = normalizeSelections(selections);
  let milk;
  let extraShot = false;
  for (const sel of sels) {
    const group = mods.find((g) => g.id === sel.groupId);
    if (!group) continue;
    if (group.id === "milk" || /milk/i.test(group.name)) milk = sel.optionId;
    if (group.id === "extra-shot" || /extra\s*shot/i.test(group.name)) extraShot = true;
  }
  return { milk, extraShot: extraShot || undefined };
}

module.exports = {
  parseModifiers,
  serializeModifiers,
  defaultMilkGroup,
  defaultExtraShotGroup,
  modifiersFromFlags,
  deriveFlagsFromModifiers,
  selectionsFromLegacy,
  normalizeSelections,
  resolveSelections,
  priceFromModifiers,
  legacyFromSelections,
  slugify,
};
