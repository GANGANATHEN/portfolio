import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  ADMIN_COOKIE_NAME,
  VISITOR_COOKIE_NAME,
  createAdminSessionToken,
  parseAndVerifyAdminSessionToken,
  hashToken,
  SESSION_SUPERSEDED_MESSAGE,
  SESSION_SUPERSEDED_CODE,
  SESSION_EXPIRED_CODE,
  SESSION_INVALID_CODE,
} from "./security";
import {
  registerActiveSessionRecord,
  getActiveSessionRecord,
  isSessionTokenSuperseded,
  revokeActiveSessionRecord,
  touchActiveSession,
  getConversationByHash,
} from "./db";
import type { ActiveSessionRecord, Conversation } from "./types";

export interface AdminAuthResult {
  authenticated: boolean;
  sessionId?: string;
  error?: string;
  code?: string;
  clearCookie?: boolean;
  activeRecord?: ActiveSessionRecord;
}

export interface VisitorAuthResult {
  valid: boolean;
  token?: string;
  tokenHash?: string;
  conversation: Conversation | null;
  error?: string;
  code?: string;
  clearCookie?: boolean;
  reason?: "NO_TOKEN" | "SUPERSEDED" | "CONVERSATION_NOT_FOUND" | "OK";
}

/**
 * Register a single active Admin session.
 * Atomically supersedes any previous admin session.
 */
export async function registerAdminActiveSession(): Promise<{
  token: string;
  sessionId: string;
  tokenHash: string;
}> {
  const sessionId = crypto.randomUUID();
  const token = createAdminSessionToken(sessionId);
  const tokenHash = hashToken(token);

  // Check if an existing active session existed to mark it superseded
  const existing = await getActiveSessionRecord("admin", "admin");
  const prevHash = existing && existing.isActive && existing.tokenHash !== tokenHash ? existing.tokenHash : null;

  const now = new Date();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  await registerActiveSessionRecord(
    {
      accountType: "admin",
      accountId: "admin",
      sessionId,
      tokenHash,
      createdAt: now.toISOString(),
      lastActiveAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + sevenDaysMs).toISOString(),
      isActive: true,
    },
    prevHash,
  );

  return { token, sessionId, tokenHash };
}

/**
 * Validate that an incoming request holds the currently active admin session.
 */
export async function validateAdminSession(
  req: NextRequest | { cookies: { get(name: string): { value?: string } | undefined } },
): Promise<AdminAuthResult> {
  let token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) {
    return {
      authenticated: false,
      error: "Unauthorized access.",
      code: "UNAUTHORIZED",
      clearCookie: false,
    };
  }

  if (token.includes("%3A") || token.includes("%3a")) {
    try {
      token = decodeURIComponent(token);
    } catch {}
  }

  const parsed = parseAndVerifyAdminSessionToken(token);
  if (!parsed.isValid) {
    return {
      authenticated: false,
      error: parsed.isExpired
        ? "Admin session expired. Please log in again."
        : "Invalid admin session token.",
      code: parsed.isExpired ? SESSION_EXPIRED_CODE : SESSION_INVALID_CODE,
      clearCookie: true,
    };
  }

  const tokenHash = hashToken(token);

  // 1. Check if this token was explicitly superseded
  const superseded = await isSessionTokenSuperseded(tokenHash);
  if (superseded) {
    return {
      authenticated: false,
      error: SESSION_SUPERSEDED_MESSAGE,
      code: SESSION_SUPERSEDED_CODE,
      clearCookie: true,
    };
  }

  // 2. Query persistent single active session registry
  let active = await getActiveSessionRecord("admin", "admin");
  if (!active) {
    // If no active session exists yet in the registry, establish this validly HMAC-signed token
    active = await registerActiveSessionRecord({
      accountType: "admin",
      accountId: "admin",
      sessionId: parsed.sessionId || crypto.randomUUID(),
      tokenHash,
      createdAt: new Date(parsed.timestamp || Date.now()).toISOString(),
      lastActiveAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
    });
  }

  if (
    !active ||
    !active.isActive ||
    active.tokenHash !== tokenHash ||
    (parsed.sessionId && active.sessionId !== parsed.sessionId)
  ) {
    return {
      authenticated: false,
      error: SESSION_SUPERSEDED_MESSAGE,
      code: SESSION_SUPERSEDED_CODE,
      clearCookie: true,
    };
  }

  // 3. Expiration check
  if (new Date(active.expiresAt).getTime() < Date.now()) {
    return {
      authenticated: false,
      error: "Admin session expired. Please log in again.",
      code: SESSION_EXPIRED_CODE,
      clearCookie: true,
    };
  }

  // Touch last active asynchronously
  touchActiveSession("admin", "admin").catch(() => {});

  return {
    authenticated: true,
    sessionId: parsed.sessionId,
    activeRecord: active,
  };
}

/**
 * Revoke admin active session on logout.
 */
export async function revokeAdminSession(token?: string | null): Promise<boolean> {
  let cleanToken = token;
  if (cleanToken && (cleanToken.includes("%3A") || cleanToken.includes("%3a"))) {
    try {
      cleanToken = decodeURIComponent(cleanToken);
    } catch {}
  }
  const tokenHash = cleanToken ? hashToken(cleanToken) : undefined;
  return revokeActiveSessionRecord("admin", "admin", tokenHash);
}

/**
 * Register a single active Visitor session for a verified email account.
 * Atomically supersedes any previous active session for this verified email.
 */
export async function registerVisitorActiveSession(
  email: string,
  token: string,
  conversationId?: string | null,
): Promise<ActiveSessionRecord> {
  const normalizedEmail = email.trim().toLowerCase();
  const tokenHash = hashToken(token);

  // Check if an existing active session existed for this email
  const existing = await getActiveSessionRecord("visitor", normalizedEmail);
  const prevHash = existing && existing.isActive && existing.tokenHash !== tokenHash ? existing.tokenHash : null;

  const now = new Date();
  const oneYearMs = 365 * 24 * 60 * 60 * 1000;

  return registerActiveSessionRecord(
    {
      accountType: "visitor",
      accountId: normalizedEmail,
      sessionId: crypto.randomUUID(),
      tokenHash,
      conversationId: conversationId || null,
      createdAt: now.toISOString(),
      lastActiveAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + oneYearMs).toISOString(),
      isActive: true,
    },
    prevHash,
  );
}

/**
 * Validate visitor request against single active session policy.
 */
export async function validateVisitorSession(
  req: NextRequest | { cookies: { get(name: string): { value?: string } | undefined } },
): Promise<VisitorAuthResult> {
  const token = req.cookies.get(VISITOR_COOKIE_NAME)?.value;
  if (!token || token.length < 32) {
    return {
      valid: false,
      reason: "NO_TOKEN",
      conversation: null,
    };
  }

  const tokenHash = hashToken(token);

  // 1. Check if this token was explicitly superseded (e.g. login on another device)
  const superseded = await isSessionTokenSuperseded(tokenHash);
  if (superseded) {
    return {
      valid: false,
      reason: "SUPERSEDED",
      error: SESSION_SUPERSEDED_MESSAGE,
      code: SESSION_SUPERSEDED_CODE,
      clearCookie: true,
      conversation: null,
    };
  }

  // 2. Fetch conversation associated with this token hash
  const conversation = await getConversationByHash(tokenHash);
  if (!conversation) {
    return {
      valid: false,
      reason: "CONVERSATION_NOT_FOUND",
      conversation: null,
    };
  }

  // 3. If conversation is email verified, enforce single active session registry
  if (conversation.emailVerified && conversation.visitorEmail) {
    const normalizedEmail = conversation.visitorEmail.trim().toLowerCase();
    const active = await getActiveSessionRecord("visitor", normalizedEmail);

    if (active && active.isActive && active.tokenHash !== tokenHash) {
      // Another device has logged into this verified account!
      // Invalidate current tokenHash
      await revokeActiveSessionRecord("visitor", normalizedEmail, tokenHash);
      return {
        valid: false,
        reason: "SUPERSEDED",
        error: SESSION_SUPERSEDED_MESSAGE,
        code: SESSION_SUPERSEDED_CODE,
        clearCookie: true,
        conversation: null,
      };
    }

    if (active) {
      touchActiveSession("visitor", normalizedEmail).catch(() => {});
    }
  }

  return {
    valid: true,
    token,
    tokenHash,
    conversation,
    reason: "OK",
  };
}

/**
 * Revoke visitor active session on logout.
 */
export async function revokeVisitorSession(
  email: string,
  token?: string | null,
): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  const tokenHash = token ? hashToken(token) : undefined;
  return revokeActiveSessionRecord("visitor", normalizedEmail, tokenHash);
}

/**
 * Generate a standard HTTP 401 rejected session response and clear cookie if requested.
 */
export function createSessionRejectedResponse(
  authResult: { error?: string; code?: string; clearCookie?: boolean },
  cookieNameToClear?: string,
): NextResponse {
  const res = NextResponse.json(
    {
      error: authResult.error || "Authentication required.",
      code: authResult.code || "UNAUTHORIZED",
    },
    { status: 401 },
  );

  if (authResult.clearCookie && cookieNameToClear) {
    res.cookies.set({
      name: cookieNameToClear,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
      expires: new Date(0),
    });
  }

  return res;
}
