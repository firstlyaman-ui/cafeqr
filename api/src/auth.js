/** Cafe login helpers — scrypt password hashes (demo-friendly). */

const crypto = require("crypto");
const { safeEqualStr } = require("./security");

const DEMO_PASS = "pass";
const DEMO_PIN = "1234";

/** Stable demo user ids per seeded cafe slug. */
const DEMO_USERS = {
  "velvet-bean": "cafe1",
  "spice-lane": "cafe2",
  "himalayan-beans": "cafe3",
};

function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(plain), salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(plain, stored) {
  const s = String(stored || "");
  if (!s) return false;
  // Legacy / demo plaintext fallback (documented)
  if (!s.startsWith("scrypt$")) {
    return safeEqualStr(String(plain), s);
  }
  const parts = s.split("$");
  if (parts.length !== 3) return false;
  const salt = parts[1];
  const expect = parts[2];
  const got = crypto.scryptSync(String(plain), salt, 32).toString("hex");
  return safeEqualStr(got, expect);
}

function demoUserForSlug(slug) {
  return DEMO_USERS[slug] || null;
}

function defaultCredsForSlug(slug) {
  const user = demoUserForSlug(slug) || `cafe-${slug}`.slice(0, 32);
  return {
    owner_user: user,
    owner_password: hashPassword(DEMO_PASS),
    staff_user: user,
    staff_password: hashPassword(DEMO_PASS),
    owner_pin: DEMO_PIN,
    staff_pin: DEMO_PIN,
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  demoUserForSlug,
  defaultCredsForSlug,
  DEMO_PASS,
  DEMO_PIN,
  DEMO_USERS,
};
