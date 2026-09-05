const { getStore } = require("./store");
const { velvetBean, spiceLane, himalayanBeans } = require("./seed-data");

async function insertCafe(store, cafe) {
  const existing = await store.getCafeBySlug(cafe.slug);
  if (existing) {
    console.log(`[seed] skip existing cafe ${cafe.slug}`);
    return existing.id;
  }

  const created = await store.createCafe({
    slug: cafe.slug,
    name: cafe.name,
    tagline: cafe.tagline,
    accent_color: cafe.accent_color,
    hours: cafe.hours,
    address: cafe.address,
    table_count: cafe.table_count,
    cash_only: cafe.cash_only,
    currency: cafe.currency,
    country: cafe.country || "US",
    tax_name: cafe.tax_name || "Tax",
    tax_rate: cafe.tax_rate ?? 0.08,
    owner_pin: cafe.owner_pin,
    staff_pin: cafe.staff_pin,
    ordering_enabled: cafe.ordering_enabled === 0 ? 0 : 1,
  });
  const cafeId = created.id;

  for (const c of cafe.categories) {
    await store.createCategory({ id: c.id, cafe_id: cafeId, name: c.name, sort: c.sort });
  }

  for (const it of cafe.items) {
    await store.createItem({
      id: it.id,
      cafe_id: cafeId,
      category_id: it.category_id,
      name: it.name,
      description: it.description,
      price: it.price,
      prep_minutes: it.prep_minutes,
      tags: it.tags,
      image: it.image,
      has_milk: it.has_milk,
      has_extra_shot: it.has_extra_shot,
      active: 1,
      available: it.available === 0 ? 0 : 1,
    });
  }

  const now = Date.now();
  for (const o of cafe.demoOrders(cafeId, now)) {
    await store.createOrder({
      id: o.id,
      cafe_id: o.cafe_id,
      table_no: o.table_no,
      guest_name: o.guest_name,
      phone: o.phone,
      notes: o.notes,
      items: o.items,
      subtotal: o.subtotal,
      tax: o.tax,
      tax_name: o.tax_name || cafe.tax_name || "",
      total: o.total,
      status: o.status,
      estimated_wait: o.estimated_wait,
      confirm_code: o.confirm_code || "",
      dining_option: o.dining_option || "dine_in",
      created_at: o.created_at,
      updated_at: o.updated_at,
    });
  }

  console.log(`[seed] inserted ${cafe.slug} (id=${cafeId})`);
  return cafeId;
}

async function resetCafe(slug) {
  const store = await getStore();
  const cafeData =
    slug === velvetBean.slug
      ? velvetBean
      : slug === spiceLane.slug
        ? spiceLane
        : slug === himalayanBeans.slug
          ? himalayanBeans
          : null;
  if (!cafeData) {
    const err = new Error("Unknown demo cafe");
    err.status = 404;
    throw err;
  }
  const existing = await store.getCafeBySlug(slug);
  if (existing) {
    await store.deleteCafeCascade(existing.id);
  }
  const id = await insertCafe(store, cafeData);
  console.log(`[seed] reset ${slug} -> id=${id}`);
  return id;
}

async function seed() {
  const store = await getStore();
  await insertCafe(store, velvetBean);
  await insertCafe(store, spiceLane);
  await insertCafe(store, himalayanBeans);
  const count = await store.countCafes();
  console.log(`[seed] cafes in db: ${count} (driver=${store.driver})`);
}

if (require.main === module) {
  seed().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { seed, insertCafe, resetCafe };
