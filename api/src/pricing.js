/** Server-side order pricing — never trust client unitPrice/subtotal/tax/total. */

function defaultSurcharges(currency) {
  const c = String(currency || "USD").toUpperCase();
  if (c === "NPR") return { altMilk: 25, extraShot: 40 };
  if (c === "INR") return { altMilk: 20, extraShot: 30 };
  return { altMilk: 0.5, extraShot: 0.75 };
}

function cafeAltMilkPrice(cafe) {
  const raw = cafe?.alt_milk_price;
  if (raw === undefined || raw === null || raw === "") {
    return defaultSurcharges(cafe?.currency).altMilk;
  }
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0) return n;
  return defaultSurcharges(cafe?.currency).altMilk;
}

function cafeExtraShotPrice(cafe) {
  const raw = cafe?.extra_shot_price;
  if (raw === undefined || raw === null || raw === "") {
    return defaultSurcharges(cafe?.currency).extraShot;
  }
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0) return n;
  return defaultSurcharges(cafe?.currency).extraShot;
}

function cafeTaxRate(cafe) {
  const n = Number(cafe?.tax_rate);
  if (Number.isFinite(n) && n >= 0) return n;
  if (cafe?.currency === "INR") return 0.05;
  if (cafe?.currency === "NPR") return 0.13;
  return 0.08;
}

function cafeTaxName(cafe) {
  return (
    String(cafe?.tax_name || "").trim() ||
    (cafe?.currency === "INR" ? "GST" : cafe?.currency === "NPR" ? "VAT" : "Tax")
  );
}

function computeTax(subtotal, rate) {
  const r = Number(rate);
  if (!Number.isFinite(r) || r <= 0) return 0;
  return Math.round(subtotal * r * 100) / 100;
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

function priceLine(itemRow, line, cafe) {
  const qty = Math.max(1, Math.min(99, Math.floor(Number(line.qty) || 1)));
  let unit = Number(itemRow.price) || 0;
  const milk = line.milk ? String(line.milk) : undefined;
  const extraShot = !!(line.extraShot || line.extra_shot);
  if ((milk === "oat" || milk === "almond") && itemRow.has_milk) {
    unit += cafeAltMilkPrice(cafe);
  }
  if (extraShot && itemRow.has_extra_shot) {
    unit += cafeExtraShotPrice(cafe);
  }
  unit = roundMoney(unit);
  return {
    itemId: itemRow.id,
    name: itemRow.name,
    qty,
    unitPrice: unit,
    milk: milk || undefined,
    extraShot: extraShot || undefined,
  };
}

function recomputeOrder(pricedLines, cafe, prepMinutesList = []) {
  const subtotal = roundMoney(pricedLines.reduce((s, l) => s + l.unitPrice * l.qty, 0));
  const taxRate = cafeTaxRate(cafe);
  const taxName = cafeTaxName(cafe);
  const tax = computeTax(subtotal, taxRate);
  const total = roundMoney(subtotal + tax);
  const estimatedWait = Math.max(2, ...prepMinutesList.map((n) => Number(n) || 0), 4);
  return { lines: pricedLines, subtotal, tax, taxName, taxRate, total, estimatedWait };
}

module.exports = {
  defaultSurcharges,
  cafeAltMilkPrice,
  cafeExtraShotPrice,
  cafeTaxRate,
  cafeTaxName,
  computeTax,
  roundMoney,
  priceLine,
  recomputeOrder,
};
