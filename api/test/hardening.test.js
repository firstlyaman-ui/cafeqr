const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  priceLine,
  recomputeOrder,
  cafeTaxRate,
  computeTax,
  defaultSurcharges,
} = require("../src/pricing");
const { validateNewPin, safeEqualStr } = require("../src/security");

describe("server-side pricing", () => {
  it("rejects forged total — recomputes from DB item price + NPR VAT 13%", () => {
    const cafe = {
      currency: "NPR",
      tax_rate: 0.13,
      tax_name: "VAT",
      alt_milk_price: 25,
      extra_shot_price: 40,
    };
    const item = {
      id: "hb-chiya",
      name: "Masala Chiya",
      price: 80,
      has_milk: 1,
      has_extra_shot: 0,
      prep_minutes: 5,
    };
    const forged = { itemId: "hb-chiya", qty: 2, unitPrice: 1, total: 1, milk: "oat" };
    const line = priceLine(item, forged, cafe);
    assert.equal(line.unitPrice, 105);
    assert.equal(line.qty, 2);
    const priced = recomputeOrder([line], cafe, [5]);
    assert.equal(priced.subtotal, 210);
    assert.equal(priced.tax, computeTax(210, 0.13));
    assert.equal(priced.tax, 27.3);
    assert.equal(priced.total, 237.3);
    assert.notEqual(priced.total, 1);
  });

  it("applies currency-aware surcharge defaults", () => {
    assert.deepEqual(defaultSurcharges("USD"), { altMilk: 0.5, extraShot: 0.75 });
    assert.deepEqual(defaultSurcharges("INR"), { altMilk: 20, extraShot: 30 });
    assert.deepEqual(defaultSurcharges("NPR"), { altMilk: 25, extraShot: 40 });
  });

  it("cafeTaxRate NPR 13%", () => {
    assert.equal(cafeTaxRate({ currency: "NPR", tax_rate: 0.13 }), 0.13);
  });

  it("null surcharge columns use currency defaults (not 0)", () => {
    const { cafeAltMilkPrice, cafeExtraShotPrice } = require("../src/pricing");
    assert.equal(cafeAltMilkPrice({ currency: "NPR", alt_milk_price: null }), 25);
    assert.equal(cafeExtraShotPrice({ currency: "NPR", extra_shot_price: null }), 40);
    assert.equal(cafeAltMilkPrice({ currency: "USD", alt_milk_price: null }), 0.5);
  });
});


describe("structured modifiers pricing", () => {
  it("prices from item modifiers (not cafe hardcoded surcharges)", () => {
    const cafe = { currency: "NPR", tax_rate: 0.13, tax_name: "VAT" };
    const item = {
      id: "hb-chiya",
      name: "Masala Chiya",
      price: 80,
      has_milk: 1,
      has_extra_shot: 0,
      modifiers: JSON.stringify([
        {
          id: "milk",
          name: "Milk",
          max: 1,
          options: [
            { id: "whole", name: "Whole", price: 0 },
            { id: "oat", name: "Oat", price: 30 },
            { id: "soy", name: "Soy", price: 35 },
          ],
        },
      ]),
    };
    const line = priceLine(item, { itemId: "hb-chiya", qty: 1, milk: "soy" }, cafe);
    assert.equal(line.unitPrice, 115);
    assert.equal(line.milk, "soy");
    const viaSel = priceLine(
      item,
      { itemId: "hb-chiya", qty: 1, selections: [{ groupId: "milk", optionId: "oat" }] },
      cafe
    );
    assert.equal(viaSel.unitPrice, 110);
  });
});

describe("PIN hygiene", () => {
  it("rejects 1234 on create", () => {
    assert.match(validateNewPin("1234", "ownerPin"), /1234/);
  });

  it("rejects short pins", () => {
    assert.match(validateNewPin("12", "ownerPin"), /at least 4/);
  });

  it("accepts stronger pins", () => {
    assert.equal(validateNewPin("9876", "ownerPin"), null);
  });

  it("timing-safe equal works", () => {
    assert.equal(safeEqualStr("1234", "1234"), true);
    assert.equal(safeEqualStr("1234", "1235"), false);
    assert.equal(safeEqualStr("1234", "123"), false);
  });
});

describe("fail-closed getStore", () => {
  it("throws without DATABASE_URL when VERCEL=1", async () => {
    const prev = {
      DATABASE_URL: process.env.DATABASE_URL,
      POSTGRES_URL: process.env.POSTGRES_URL,
      POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL,
      VERCEL: process.env.VERCEL,
      NODE_ENV: process.env.NODE_ENV,
      CAFEQR_ALLOW_SQLITE_FALLBACK: process.env.CAFEQR_ALLOW_SQLITE_FALLBACK,
    };
    try {
      delete process.env.DATABASE_URL;
      delete process.env.POSTGRES_URL;
      delete process.env.POSTGRES_PRISMA_URL;
      delete process.env.CAFEQR_ALLOW_SQLITE_FALLBACK;
      process.env.VERCEL = "1";
      delete require.cache[require.resolve("../src/store")];
      const { getStore, resetStoreCache } = require("../src/store");
      resetStoreCache();
      await assert.rejects(() => getStore(), /DATABASE_URL is required/);
    } finally {
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      delete require.cache[require.resolve("../src/store")];
      const { resetStoreCache } = require("../src/store");
      resetStoreCache();
    }
  });
});


describe("mapOrder", () => {
  const { mapOrder } = require("../src/index");

  it("maps snake_case DB row to camelCase client order JSON", () => {
    const row = {
      id: "VB-1001",
      cafe_id: "c1",
      table_no: "04",
      guest_name: "Ada",
      phone: "555",
      notes: "extra hot",
      items: JSON.stringify([{ itemId: "i1", name: "Latte", qty: 1, unitPrice: 4.5 }]),
      subtotal: 4.5,
      tax: 0.36,
      tax_name: "Tax",
      total: 4.86,
      status: "new",
      estimated_wait: 8,
      confirm_code: "4321",
      dining_option: "dine_in",
      created_at: 1700000000000,
      updated_at: 1700000001000,
    };
    const o = mapOrder(row);
    assert.equal(o.id, "VB-1001");
    assert.equal(o.table, "04");
    assert.equal(o.guestName, "Ada");
    assert.equal(o.phone, "555");
    assert.equal(o.notes, "extra hot");
    assert.equal(o.items.length, 1);
    assert.equal(o.items[0].name, "Latte");
    assert.equal(o.subtotal, 4.5);
    assert.equal(o.tax, 0.36);
    assert.equal(o.taxName, "Tax");
    assert.equal(o.total, 4.86);
    assert.equal(o.status, "new");
    assert.equal(o.estimatedWait, 8);
    assert.equal(o.confirmCode, "4321");
    assert.equal(o.diningOption, "dine_in");
    assert.equal(o.createdAt, 1700000000000);
    assert.equal(o.payCash, true);
  });

  it("parses already-array items and takeaway dining", () => {
    const o = mapOrder({
      id: "X-1",
      table_no: "01",
      guest_name: "Guest",
      items: [{ itemId: "a", name: "Tea", qty: 2, unitPrice: 2 }],
      subtotal: 4,
      tax: 0,
      total: 4,
      status: "preparing",
      estimated_wait: 5,
      confirm_code: "1111",
      dining_option: "takeaway",
      created_at: 1,
      updated_at: 2,
    });
    assert.equal(o.items[0].qty, 2);
    assert.equal(o.diningOption, "takeaway");
  });

  it("returns null for missing row", () => {
    assert.equal(mapOrder(null), null);
  });
});


describe("auth credentials", () => {
  const { hashPassword, verifyPassword, defaultCredsForSlug, DEMO_USERS } = require("../src/auth");

  it("hashes and verifies passwords", () => {
    const h = hashPassword("pass");
    assert.equal(verifyPassword("pass", h), true);
    assert.equal(verifyPassword("nope", h), false);
  });

  it("maps seeded cafes to cafe1/2/3", () => {
    assert.equal(DEMO_USERS["velvet-bean"], "cafe1");
    assert.equal(DEMO_USERS["spice-lane"], "cafe2");
    assert.equal(DEMO_USERS["himalayan-beans"], "cafe3");
    assert.equal(defaultCredsForSlug("velvet-bean").owner_user, "cafe1");
    assert.equal(defaultCredsForSlug("spice-lane").staff_user, "cafe2");
  });
});
