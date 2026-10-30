import crypto from "crypto";

export const VISITOR_COOKIE_NAME = "ganganathan_visitor_session";
export const ADMIN_COOKIE_NAME = "ganganathan_admin_session";

// Secret used strictly for signing admin session cookies and HMAC hashing
// In production, ADMIN_SECRET_KEY must be provided via environment variables.
// In dev/test, fallback to a process-lifetime ephemeral 32-byte random secret.
const devSecretFallback = crypto.randomBytes(32).toString("hex");
function getAuthSecret(): string {
  const envSecret = process.env.ADMIN_SECRET_KEY;
  if (envSecret && envSecret.trim().length >= 32) {
    return envSecret.trim();
  }
  if (process.env.NODE_ENV === "production") {
    console.error("[Security Alert] ADMIN_SECRET_KEY is missing or too short in production! Set a 32+ char secret in Vercel.");
  }
  return devSecretFallback;
}

/**
 * Generate a cryptographically secure random session token (32 bytes = 64 hex chars)
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
 * Generate a 6-digit numeric OTP (100000 - 999999) using cryptographic randomness
 */
export function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hash an OTP with HMAC-SHA256 using server secret and normalized email salt
 * Prevents rainbow tables and dictionary attacks. Never stores plaintext OTPs.
 */
export function hashOtp(email: string, otp: string): string {
  const secret = getAuthSecret();
  const normalized = `${email.trim().toLowerCase()}:${otp.trim()}`;
  return crypto.createHmac("sha256", secret).update(normalized).digest("hex");
}

/**
 * Verify candidate OTP against expected HMAC hash using constant-time comparison
 */
export function verifyOtpHash(email: string, candidateOtp: string, expectedHash: string): boolean {
  if (!email || !candidateOtp || !expectedHash) return false;
  const candidateHash = hashOtp(email, candidateOtp);
  try {
    const candidateBuf = Buffer.from(candidateHash, "hex");
    const expectedBuf = Buffer.from(expectedHash, "hex");
    if (candidateBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(candidateBuf, expectedBuf);
  } catch {
    return false;
  }
}

/**
 * Sanitize user input to prevent XSS and HTML/script injection
 */
export function sanitizeText(input: string): string {
  if (!input) return "";
  return input
    .replace(/[<>]/g, "") // Strip raw HTML tag brackets
    .trim()
    .slice(0, 2000);
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

export const SESSION_SUPERSEDED_MESSAGE =
  "Your account was signed in on another device. Please log in again.";
export const SESSION_SUPERSEDED_CODE = "SESSION_SUPERSEDED";
export const SESSION_EXPIRED_CODE = "SESSION_EXPIRED";
export const SESSION_INVALID_CODE = "SESSION_INVALID";

/**
 * Create a signed Admin Session token (HMAC-SHA256 with timestamp and unique sessionId)
 */
export function createAdminSessionToken(sessionId: string = crypto.randomUUID()): string {
  const secret = getAuthSecret();
  const timestamp = Date.now();
  const payload = `admin:${sessionId}:${timestamp}`;
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}:${hmac}`;
}

export interface ParsedAdminSessionToken {
  isValid: boolean;
  sessionId?: string;
  timestamp?: number;
  isExpired?: boolean;
}

/**
 * Parse and verify a signed Admin Session token with constant-time HMAC check
 */
export function parseAndVerifyAdminSessionToken(token: string | null | undefined): ParsedAdminSessionToken {
  if (!token) return { isValid: false };
  let cleanToken = token;
  if (cleanToken.includes("%3A") || cleanToken.includes("%3a")) {
    try {
      cleanToken = decodeURIComponent(cleanToken);
    } catch {}
  }
  const parts = cleanToken.split(":");
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const secret = getAuthSecret();

  // New format with unique sessionId: admin:${sessionId}:${timestamp}:${hmac}
  if (parts.length === 4) {
    const [role, sessionId, timestampStr, signature] = parts;
    if (role !== "admin" || !sessionId) return { isValid: false };

    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) return { isValid: false };

    if (Date.now() - timestamp > sevenDaysMs) {
      return { isValid: false, isExpired: true, sessionId, timestamp };
    }

    const payload = `admin:${sessionId}:${timestampStr}`;
    const expectedHmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    try {
      const match = crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedHmac, "hex"));
      return { isValid: match, sessionId, timestamp, isExpired: false };
    } catch {
      return { isValid: false };
    }
  }

  // Legacy format: admin:${timestamp}:${hmac}
  if (parts.length === 3) {
    const [role, timestampStr, signature] = parts;
    if (role !== "admin") return { isValid: false };

    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) return { isValid: false };

    if (Date.now() - timestamp > sevenDaysMs) {
      return { isValid: false, isExpired: true, timestamp };
    }

    const payload = `admin:${timestampStr}`;
    const expectedHmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    try {
      const match = crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedHmac, "hex"));
      return { isValid: match, timestamp, isExpired: false };
    } catch {
      return { isValid: false };
    }
  }

  return { isValid: false };
}

/**
 * Verify a signed Admin Session token
 * Valid for 7 days with constant-time comparison
 */
export function verifyAdminSessionToken(token: string | null | undefined): boolean {
  return parseAndVerifyAdminSessionToken(token).isValid;
}

/**
 * Verify admin password strictly against configured ADMIN_PASSWORD environment variable.
 * Does NOT hardcode default passwords. Fails closed if ADMIN_PASSWORD is unset.
 */
export function verifyAdminPassword(candidate: string): boolean {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!candidate || !configuredPassword || configuredPassword.trim() === "") {
    console.warn("[Admin Auth] Login attempt rejected: ADMIN_PASSWORD environment variable is not configured.");
    return false;
  }

  const candidateBuf = Buffer.from(candidate);
  const configuredBuf = Buffer.from(configuredPassword);

  if (candidateBuf.length !== configuredBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(candidateBuf, configuredBuf);
}
