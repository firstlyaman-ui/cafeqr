const crypto = require("crypto");

/** Constant-time string compare for PINs / tokens. Different lengths → false. */
function safeEqualStr(a, b) {
  const aa = Buffer.from(String(a ?? ""), "utf8");
  const bb = Buffer.from(String(b ?? ""), "utf8");
  if (aa.length !== bb.length) {
    const dig = crypto.createHash("sha256").update(aa).update(bb).digest();
    crypto.timingSafeEqual(dig, dig);
    return false;
  }
  if (aa.length === 0) return false;
  return crypto.timingSafeEqual(aa, bb);
}

/** Reject weak / too-short PINs on cafe create (seed demos may still use 1234). */
function validateNewPin(pin, label = "PIN") {
  const p = String(pin ?? "");
  if (p.length < 4) return `${label} must be at least 4 characters`;
  if (p === "1234") return `${label} cannot be 1234 (reserved for demo seed cafes)`;
  return null;
}

/**
 * In-memory rate limiter (advisory on serverless — per isolate).
 * Fixes off-by-one: reject when count >= max BEFORE incrementing.
 */
function createRateLimiter({ windowMs = 60_000, max = 30, mapLimit = 5000 } = {}) {
  const hits = new Map();
  return function rateLimit(req, res, next, opts = {}) {
    const { sendError } = require("./errors");
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "unknown";
    const keyExtra = opts.keyExtra != null ? opts.keyExtra : req.params?.slug || "";
    const key = `${ip}:${keyExtra}`;
    const now = Date.now();
    const limit = opts.maxOverride != null ? opts.maxOverride : max;
    let bucket = hits.get(key);
    if (!bucket || now - bucket.start > windowMs) {
      bucket = { start: now, count: 0 };
      hits.set(key, bucket);
    }
    if (bucket.count >= limit) {
      return sendError(res, 429, "RATE_LIMITED", "Too many requests — try again shortly");
    }
    bucket.count += 1;
    if (hits.size > mapLimit) {
      for (const [k, v] of hits) {
        if (now - v.start > windowMs * 2) hits.delete(k);
      }
    }
    if (typeof next === "function") next();
    return true;
  };
}

module.exports = { safeEqualStr, validateNewPin, createRateLimiter };
