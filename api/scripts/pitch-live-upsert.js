#!/usr/bin/env node
/**
 * Upsert pitch fields + NUKKAD (velvet-bean) NPR prices/images on LIVE Neon
 * via owner PIN PATCH (no DATABASE_URL required).
 *
 * Usage:
 *   API_BASE=https://cafeqr-api.vercel.app OWNER_PIN=1234 node api/scripts/pitch-live-upsert.js
 */
const API = (process.env.API_BASE || "https://cafeqr-api.vercel.app").replace(/\/$/, "");
const PIN = process.env.OWNER_PIN || "1234";

const IMG = {
  "vb-macchiato":
    "https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=900&q=80",
  "vb-avocado":
    "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=900&q=80",
  "vb-panini":
    "https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=900&q=80",
};

const VB_PRICES = {
  "vb-flat-white": 220,
  "vb-macchiato": 250,
  "vb-nitro": 230,
  "vb-matcha": 280,
  "vb-chai": 200,
  "vb-truffle-toast": 480,
  "vb-avocado": 420,
  "vb-pancakes": 450,
  "vb-panini": 440,
  "vb-bowl": 400,
  "vb-croissant": 180,
  "vb-babka": 160,
};

async function patch(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-Owner-Pin": PIN,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${res.status} ${path}: ${text.slice(0, 400)}`);
  }
  return json;
}

async function main() {
  console.log(`Upserting against ${API}`);

  const vbCafe = await patch("/cafes/velvet-bean", {
    address: "Lazimpat Road, Kathmandu",
    currency: "NPR",
    country: "NP",
    taxName: "VAT",
    taxRate: 0.13,
    altMilkPrice: 25,
    extraShotPrice: 40,
    headerMessages: [
      "नमस्ते — आजको स्पेशल सोध्नुहोस् · Ask about today's special",
      "नगद मात्र — अर्डर # र PIN · Cash only — pay with order # and PIN",
    ],
    guestStatusEnabled: false,
    lastCallEnabled: false,
    lastCallMessage: "अन्तिम अर्डर — किचन बन्द हुँदैछ · Last call — kitchen closing soon",
  });
  console.log("velvet-bean cafe:", {
    name: vbCafe.cafe?.name || vbCafe.name,
    address: vbCafe.cafe?.address || vbCafe.address,
    headerMessages: vbCafe.cafe?.headerMessages || vbCafe.headerMessages,
  });

  const hbCafe = await patch("/cafes/himalayan-beans", {
    address: "Thamel Marg, Kathmandu",
    currency: "NPR",
    country: "NP",
    taxName: "VAT",
    taxRate: 0.13,
    headerMessages: [
      "नमस्ते — आजको मोमो सोध्नुहोस् · Namaste — ask about today's momo",
      "नगद मात्र — काउन्टरमा अर्डर # र PIN · Cash only — pay with order # and PIN",
    ],
    guestStatusEnabled: true,
    lastCallEnabled: false,
    lastCallMessage: "अन्तिम अर्डर — किचन बन्द हुँदैछ · Last call — kitchen closing soon",
  });
  console.log("himalayan-beans cafe:", {
    name: hbCafe.cafe?.name || hbCafe.name,
    address: hbCafe.cafe?.address || hbCafe.address,
    guestStatusEnabled: hbCafe.cafe?.guestStatusEnabled ?? hbCafe.guestStatusEnabled,
    headerMessages: hbCafe.cafe?.headerMessages || hbCafe.headerMessages,
  });

  for (const [id, price] of Object.entries(VB_PRICES)) {
    const body = { price };
    if (IMG[id]) body.image = IMG[id];
    // Rebuild NPR milk/extra-shot modifiers for drink items that had custom junk options
    if (["vb-flat-white", "vb-macchiato", "vb-matcha", "vb-chai"].includes(id)) {
      body.hasMilk = true;
      if (id === "vb-flat-white" || id === "vb-macchiato") body.hasExtraShot = true;
      else body.hasExtraShot = false;
    }
    const updated = await patch(`/cafes/velvet-bean/items/${id}`, body);
    console.log(`item ${id}: price=${updated.price} imageOk=${!!updated.image}`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
