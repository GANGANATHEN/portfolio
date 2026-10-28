import { test, describe } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

const AUTH_SECRET = process.env.ADMIN_SECRET_KEY || process.env.ADMIN_PASSWORD || "dev_admin_secret_key_ganganathan_2026_super_secure";

// Direct pure implementations matching security.ts
function generateSecureToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function sanitizeText(input) {
  if (!input) return "";
  return input.replace(/[<>]/g, "").trim().slice(0, 2000);
}

function isValidEmail(email) {
  if (!email || email.length > 254) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function createAdminSessionToken() {
  const timestamp = Date.now();
  const payload = `admin:${timestamp}`;
  const hmac = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("hex");
  return `${payload}:${hmac}`;
}

function verifyAdminSessionToken(token) {
  if (!token) return false;
  const parts = token.split(":");
  if (parts.length !== 3) return false;
  const [role, timestampStr, signature] = parts;
  if (role !== "admin") return false;
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;
  if (Date.now() - timestamp > 7 * 24 * 60 * 60 * 1000) return false;
  const payload = `admin:${timestampStr}`;
  const expectedHmac = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedHmac, "hex"));
  } catch {
    return false;
  }
}

describe("Security & Cryptographic Isolation Suite", () => {
  test("generates 64-character high entropy hex session tokens", () => {
    const t1 = generateSecureToken();
    const t2 = generateSecureToken();
    assert.equal(t1.length, 64);
    assert.equal(t2.length, 64);
    assert.notEqual(t1, t2);
  });

  test("SHA-256 token hashing produces consistent irreversible hashes", () => {
    const token = generateSecureToken();
    const h1 = hashToken(token);
    const h2 = hashToken(token);
    assert.equal(h1, h2);
    assert.equal(h1.length, 64);
    assert.notEqual(token, h1);
  });

  test("sanitizes text and prevents HTML / script injection", () => {
    const malicious = "<script>alert('XSS')</script>Hello <b>World</b>";
    const cleaned = sanitizeText(malicious);
    assert.equal(cleaned, "scriptalert('XSS')/scriptHello bWorld/b");
    assert.equal(cleaned.includes("<"), false);
    assert.equal(cleaned.includes(">"), false);
  });

  test("validates email formats accurately", () => {
    assert.equal(isValidEmail("test@example.com"), true);
    assert.equal(isValidEmail("user.name+tag@domain.co.uk"), true);
    assert.equal(isValidEmail("invalid-email"), false);
    assert.equal(isValidEmail("@missingusername.com"), false);
    assert.equal(isValidEmail("missingdomain@"), false);
  });

  test("admin session signing and verification", () => {
    const token = createAdminSessionToken();
    assert.equal(verifyAdminSessionToken(token), true);
    assert.equal(verifyAdminSessionToken("invalid:token:format"), false);
    assert.equal(verifyAdminSessionToken(null), false);
    assert.equal(verifyAdminSessionToken(undefined), false);

    // Tampered token test
    const tampered = token.slice(0, -4) + "ffff";
    assert.equal(verifyAdminSessionToken(tampered), false);
  });
});

