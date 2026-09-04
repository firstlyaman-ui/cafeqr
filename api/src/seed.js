const { getDb } = require("./db");
const { velvetBean, spiceLane } = require("./seed-data");

function insertCafe(db, cafe) {
  const existing = db.prepare("SELECT id FROM cafes WHERE slug = ?").get(cafe.slug);
  if (existing) {
    console.log(`[seed] skip existing cafe ${cafe.slug}`);
    return existing.id;
  }

  const info = db.prepare(
    `INSERT INTO cafes (slug, name, tagline, accent_color, hours, address, table_count, cash_only, currency, owner_pin, staff_pin)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    cafe.slug,
    cafe.name,
    cafe.tagline,
    cafe.accent_color,
    cafe.hours,
    cafe.address,
    cafe.table_count,
    cafe.cash_only,
    cafe.currency,
    cafe.owner_pin,
    cafe.staff_pin
  );
  const cafeId = info.lastInsertRowid;

  const insCat = db.prepare(
    `INSERT INTO categories (id, cafe_id, name, sort) VALUES (?, ?, ?, ?)`
  );
  for (const c of cafe.categories) {
    insCat.run(c.id, cafeId, c.name, c.sort);
  }

  const insItem = db.prepare(
    `INSERT INTO items (id, cafe_id, category_id, name, description, price, prep_minutes, tags, image, has_milk, has_extra_shot, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  );
  for (const it of cafe.items) {
    insItem.run(
      it.id,
      cafeId,
      it.category_id,
      it.name,
      it.description,
      it.price,
      it.prep_minutes,
      JSON.stringify(it.tags),
      it.image,
      it.has_milk,
      it.has_extra_shot
    );
  }

  const now = Date.now();
  const insOrd = db.prepare(
    `INSERT INTO orders (id, cafe_id, table_no, guest_name, phone, notes, items, subtotal, tax, total, status, estimated_wait, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const o of cafe.demoOrders(cafeId, now)) {
    insOrd.run(
      o.id,
      o.cafe_id,
      o.table_no,
      o.guest_name,
      o.phone,
      o.notes,
      JSON.stringify(o.items),
      o.subtotal,
      o.tax,
      o.total,
      o.status,
      o.estimated_wait,
      o.created_at,
      o.updated_at
    );
  }

  console.log(`[seed] inserted ${cafe.slug} (id=${cafeId})`);
  return cafeId;
}

async function seed() {
  const db = await getDb();
  insertCafe(db, velvetBean);
  insertCafe(db, spiceLane);
  const count = db.prepare("SELECT COUNT(*) as n FROM cafes").get();
  console.log(`[seed] cafes in db: ${count.n}`);
}

if (require.main === module) {
  seed().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { seed, insertCafe };
