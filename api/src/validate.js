const { z } = require("zod");

const modifierOptionSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  price: z.union([z.number(), z.string()]).optional(),
}).passthrough();

const modifierGroupSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  required: z.boolean().optional(),
  max: z.union([z.number(), z.string()]).optional(),
  options: z.array(modifierOptionSchema).optional(),
}).passthrough();

const createCafeSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  tagline: z.string().optional(),
  accentColor: z.string().optional(),
  accent_color: z.string().optional(),
  hours: z.string().optional(),
  address: z.string().optional(),
  tableCount: z.union([z.number(), z.string()]).optional(),
  table_count: z.union([z.number(), z.string()]).optional(),
  cashOnly: z.boolean().optional(),
  cash_only: z.union([z.number(), z.boolean()]).optional(),
  currency: z.enum(["USD", "INR", "NPR"]).optional(),
  country: z.string().max(8).optional(),
  taxName: z.string().max(64).optional(),
  tax_name: z.string().max(64).optional(),
  taxRate: z.union([z.number(), z.string()]).optional(),
  tax_rate: z.union([z.number(), z.string()]).optional(),
  altMilkPrice: z.union([z.number(), z.string()]).optional(),
  alt_milk_price: z.union([z.number(), z.string()]).optional(),
  extraShotPrice: z.union([z.number(), z.string()]).optional(),
  extra_shot_price: z.union([z.number(), z.string()]).optional(),
  ownerPin: z.string().min(4).optional(),
  owner_pin: z.string().min(4).optional(),
  staffPin: z.string().min(4).optional(),
  staff_pin: z.string().min(4).optional(),
  orderingEnabled: z.boolean().optional(),
  ordering_enabled: z.union([z.number(), z.boolean()]).optional(),
}).refine((b) => !!(b.slug || b.name), { message: "slug or name required" })
  .refine((b) => !!(b.ownerPin || b.owner_pin), { message: "ownerPin required" })
  .refine((b) => !!(b.staffPin || b.staff_pin), { message: "staffPin required" });

const patchCafeSchema = z.object({
  name: z.string().optional(),
  tagline: z.string().optional(),
  accentColor: z.string().optional(),
  accent_color: z.string().optional(),
  hours: z.string().optional(),
  address: z.string().optional(),
  tableCount: z.union([z.number(), z.string()]).optional(),
  table_count: z.union([z.number(), z.string()]).optional(),
  cashOnly: z.boolean().optional(),
  cash_only: z.union([z.number(), z.boolean()]).optional(),
  currency: z.enum(["USD", "INR", "NPR"]).optional(),
  country: z.string().max(8).optional(),
  taxName: z.string().max(64).optional(),
  tax_name: z.string().max(64).optional(),
  taxRate: z.union([z.number(), z.string()]).optional(),
  tax_rate: z.union([z.number(), z.string()]).optional(),
  altMilkPrice: z.union([z.number(), z.string()]).optional(),
  alt_milk_price: z.union([z.number(), z.string()]).optional(),
  extraShotPrice: z.union([z.number(), z.string()]).optional(),
  extra_shot_price: z.union([z.number(), z.string()]).optional(),
  orderingEnabled: z.boolean().optional(),
  ordering_enabled: z.union([z.number(), z.boolean()]).optional(),
}).passthrough();

const categorySchema = z.object({
  name: z.string().min(1).optional(),
  sort: z.union([z.number(), z.string()]).optional(),
});

const itemSchema = z.object({
  id: z.string().optional(),
  categoryId: z.string().optional(),
  category_id: z.string().optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.union([z.number(), z.string()]).optional(),
  prepMinutes: z.union([z.number(), z.string()]).optional(),
  prep_minutes: z.union([z.number(), z.string()]).optional(),
  tags: z.array(z.string()).optional(),
  image: z.string().max(2048, "image URL too long").optional(),
  hasMilk: z.boolean().optional(),
  has_milk: z.union([z.boolean(), z.number()]).optional(),
  hasExtraShot: z.boolean().optional(),
  has_extra_shot: z.union([z.boolean(), z.number()]).optional(),
  modifiers: z.array(modifierGroupSchema).optional(),
  active: z.boolean().optional(),
  available: z.union([z.boolean(), z.number()]).optional(),
}).passthrough();

const orderLineSchema = z.object({
  itemId: z.string().optional(),
  item_id: z.string().optional(),
  name: z.string().optional(),
  qty: z.union([z.number(), z.string()]).optional(),
  unitPrice: z.union([z.number(), z.string()]).optional(),
  milk: z.string().optional(),
  extraShot: z.union([z.boolean(), z.number()]).optional(),
  extra_shot: z.union([z.boolean(), z.number()]).optional(),
  selections: z.array(z.object({
    groupId: z.string().optional(),
    group_id: z.string().optional(),
    optionId: z.string().optional(),
    option_id: z.string().optional(),
  }).passthrough()).optional(),
}).passthrough();

const placeOrderSchema = z.object({
  id: z.string().optional(),
  table: z.union([z.string(), z.number()]).optional(),
  table_no: z.union([z.string(), z.number()]).optional(),
  guestName: z.string().optional(),
  guest_name: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(orderLineSchema).min(1, "items required"),
  subtotal: z.union([z.number(), z.string()]).optional(),
  tax: z.union([z.number(), z.string()]).optional(),
  total: z.union([z.number(), z.string()]).optional(),
  estimatedWait: z.union([z.number(), z.string()]).optional(),
  estimated_wait: z.union([z.number(), z.string()]).optional(),
  confirmCode: z.string().optional(),
  confirm_code: z.string().optional(),
  diningOption: z.string().optional(),
  dining_option: z.string().optional(),
});

const patchOrderSchema = z.object({
  status: z.enum(["new", "preparing", "ready", "paid", "cancelled"]),
  confirm: z.string().optional(),
  confirmCode: z.string().optional(),
  confirm_code: z.string().optional(),
});

const pinBodySchema = z.object({
  pin: z.string().min(1),
});

module.exports = {
  createCafeSchema,
  patchCafeSchema,
  categorySchema,
  itemSchema,
  placeOrderSchema,
  patchOrderSchema,
  pinBodySchema,
};
