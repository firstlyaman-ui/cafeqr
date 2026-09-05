const { getDb } = require("./db");
const { velvetBean, spiceLane } = require("./seed-data");

function insertCafe(db, cafe) {
  const existing = db.prepare("SELECT id FROM cafes WHERE slug = ?").get(cafe.slug);
  if (existing) {
    console.log(`[seed] skip existing cafe ${cafe.slug}`);
    return existing.id;
  }

  const info = db.prepare(
    `INSERT INTO cafes (slug, name, tagline, accent_color, hours, address, table_count, cash_only, currency, owner_pin, staff_pin, ordering_enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
    cafe.staff_pin,
    cafe.ordering_enabled === 0 ? 0 : 1
  );
  const cafeId = info.lastInsertRowid;

  const insCat = db.prepare(
    `INSERT INTO categories (id, cafe_id, name, sort) VALUES (?, ?, ?, ?)`
  );
  for (const c of cafe.categories) {
    insCat.run(c.id, cafeId, c.name, c.sort);
  }

  const insItem = db.prepare(
    `INSERT INTO items (id, cafe_id, category_id, name, description, price, prep_minutes, tags, image, has_milk, has_extra_shot, active, available)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
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
      it.has_extra_shot,
      it.available === 0 ? 0 : 1
    );
  }

  const now = Date.now();
  const insOrd = db.prepare(
    `INSERT INTO orders (id, cafe_id, table_no, guest_name, phone, notes, items, subtotal, tax, total, status, estimated_wait, confirm_code, dining_option, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      o.confirm_code || "",
      o.dining_option || "dine_in",
      o.created_at,
      o.updated_at
    );
  }

  console.log(`[seed] inserted ${cafe.slug} (id=${cafeId})`);
  return cafeId;
}

async function resetCafe(slug) {
  const db = await getDb();
  const cafeData = slug === velvetBean.slug ? velvetBean : slug === spiceLane.slug ? spiceLane : null;
  if (!cafeData) {
    const err = new Error("Unknown demo cafe");
    err.status = 404;
    throw err;
  }
  const existing = db.prepare("SELECT id FROM cafes WHERE slug = ?").get(slug);
  if (existing) {
    db.prepare("DELETE FROM orders WHERE cafe_id = ?").run(existing.id);
    db.prepare("DELETE FROM items WHERE cafe_id = ?").run(existing.id);
    db.prepare("DELETE FROM categories WHERE cafe_id = ?").run(existing.id);
    db.prepare("DELETE FROM cafes WHERE id = ?").run(existing.id);
  }
  const id = insertCafe(db, cafeData);
  console.log(`[seed] reset ${slug} -> id=${id}`);
  return id;
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

module.exports = { seed, insertCafe, resetCafe };
