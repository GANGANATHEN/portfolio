import crypto from "crypto";

export const VISITOR_COOKIE_NAME = "ganganathan_visitor_session";
export const ADMIN_COOKIE_NAME = "ganganathan_admin_session";

// Secret used for signing admin sessions
const AUTH_SECRET =
  process.env.ADMIN_SECRET_KEY ||
  process.env.ADMIN_PASSWORD ||
  "portfolio-admin-secure-fallback-secret-2026";

/**
 * Generate a cryptographically secure random session token
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Hash token using SHA-256 for secure database indexing/lookup
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Sanitize user input to prevent XSS and injection
 */
export function sanitizeText(input: string): string {
  if (!input) return "";
  return input
    .replace(/[<>]/g, "") // Strip raw HTML tags
    .trim()
    .slice(0, 2000);
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Create a signed Admin Session token (HMAC-SHA256 with timestamp)
 */
export function createAdminSessionToken(): string {
  const timestamp = Date.now();
  const payload = `admin:${timestamp}`;
  const hmac = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("hex");
  return `${payload}:${hmac}`;
}

/**
 * Verify a signed Admin Session token
 * Valid for 7 days
 */
export function verifyAdminSessionToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const parts = token.split(":");
  if (parts.length !== 3) return false;

  const [role, timestampStr, signature] = parts;
  if (role !== "admin") return false;

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;

  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - timestamp > sevenDaysMs) {
    return false; // Expired
  }

  const payload = `admin:${timestampStr}`;
  const expectedHmac = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("hex");

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedHmac, "hex"));
  } catch {
    return false;
  }
}

/**
 * Verify admin password against configured ADMIN_PASSWORD or ADMIN_SECRET_KEY
 */
export function verifyAdminPassword(candidate: string): boolean {
  const configuredPassword = process.env.ADMIN_PASSWORD || process.env.ADMIN_SECRET_KEY || "ganganathan123";
  if (!candidate || !configuredPassword) return false;

  // Constant-time comparison
  const candidateBuf = Buffer.from(candidate);
  const configuredBuf = Buffer.from(configuredPassword);

  if (candidateBuf.length !== configuredBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(candidateBuf, configuredBuf);
}

