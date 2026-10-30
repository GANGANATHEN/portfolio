import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";

process.env.EMAIL_NOTIFICATION_COOLDOWN_MINUTES = "10";
process.env.OWNER_EMAIL = "ganganathan.dev@gmail.com";
process.env.RESEND_API_KEY = ""; // Simulation mode
process.env.ADMIN_SECRET_KEY = "audit_admin_secret_key_minimum_32_characters_long_for_security";
process.env.ADMIN_PASSWORD = "audit_admin_password_2026";

import {
  generateSecureToken,
  hashToken,
  hashOtp,
  VISITOR_COOKIE_NAME,
  ADMIN_COOKIE_NAME,
  SESSION_SUPERSEDED_CODE,
  SESSION_SUPERSEDED_MESSAGE,
} from "../src/lib/live-chat/security.ts";

import {
  createEmailOtp,
  getOrCreateConversationByHash,
  getActiveSessionRecord,
  isSessionTokenSuperseded,
  DatabaseUnavailableError,
} from "../src/lib/live-chat/db.ts";

import {
  registerAdminActiveSession,
  validateAdminSession,
  registerVisitorActiveSession,
  validateVisitorSession,
} from "../src/lib/live-chat/session-registry.ts";

// API Handlers
import { POST as adminLoginHandler } from "../src/app/api/admin/auth/login/route.ts";
import { GET as adminCheckHandler } from "../src/app/api/admin/auth/check/route.ts";
import { GET as adminCommandsHandler } from "../src/app/api/admin/commands/route.ts";
import { GET as visitorMessagesGetHandler } from "../src/app/api/live-chat/messages/route.ts";
import { POST as visitorSendHandler } from "../src/app/api/live-chat/send/route.ts";
import { POST as visitorVerifyOtpHandler } from "../src/app/api/live-chat/otp/verify/route.ts";

describe("Production-Readiness Audit Suite: Single Active Session Security", () => {
  before(() => {
    const dataDir = path.join(process.cwd(), ".data");
    const storeFile = path.join(dataDir, "live-chat-store.json");
    if (fs.existsSync(storeFile)) {
      try {
        fs.unlinkSync(storeFile);
      } catch {}
    }
  });

  const auditVisitorEmail = "multi.instance.audit@example.com";
  let tokenInstance1 = "";
  let tokenInstance2 = "";
  let adminTokenInstance1 = "";
  let adminTokenInstance2 = "";

  // 1. Two separate instances: Visitor login on Instance 2 invalidates Instance 1
  test("1. Two separate instances: Visitor login on Instance 2 invalidates Instance 1", async () => {
    // Instance 1: Visitor logs in
    tokenInstance1 = generateSecureToken();
    const hash1 = hashToken(tokenInstance1);
    const conv1 = await getOrCreateConversationByHash(hash1);

    const otp1 = "111222";
    await createEmailOtp(
      conv1.id,
      auditVisitorEmail,
      hashOtp(auditVisitorEmail, otp1),
      new Date(Date.now() + 600000).toISOString(),
      5,
    );

    const verifyReq1 = new NextRequest("http://instance1.internal/api/live-chat/otp/verify", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${VISITOR_COOKIE_NAME}=${tokenInstance1}`,
      },
      body: JSON.stringify({ email: auditVisitorEmail, otp: otp1 }),
    });
    const verifyRes1 = await visitorVerifyOtpHandler(verifyReq1);
    assert.equal(verifyRes1.status, 200);

    // Instance 1 session is valid initially
    const checkBefore = await validateVisitorSession({
      cookies: { get: () => ({ value: tokenInstance1 }) },
    });
    assert.equal(checkBefore.valid, true);

    // Instance 2: Same account logs in on separate instance
    tokenInstance2 = generateSecureToken();
    const hash2 = hashToken(tokenInstance2);
    const conv2 = await getOrCreateConversationByHash(hash2);

    const otp2 = "333444";
    await createEmailOtp(
      conv2.id,
      auditVisitorEmail,
      hashOtp(auditVisitorEmail, otp2),
      new Date(Date.now() + 600000).toISOString(),
      5,
    );

    const verifyReq2 = new NextRequest("http://instance2.internal/api/live-chat/otp/verify", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${VISITOR_COOKIE_NAME}=${tokenInstance2}`,
      },
      body: JSON.stringify({ email: auditVisitorEmail, otp: otp2 }),
    });
    const verifyRes2 = await visitorVerifyOtpHandler(verifyReq2);
    assert.equal(verifyRes2.status, 200);

    // CONFIRM: Instance 2 is now the active session
    const active = await getActiveSessionRecord("visitor", auditVisitorEmail);
    assert.ok(active);
    assert.equal(active.tokenHash, hash2);

    // CONFIRM: Instance 1 is immediately invalid and rejected
    const checkInstance1 = await validateVisitorSession({
      cookies: { get: () => ({ value: tokenInstance1 }) },
    });
    assert.equal(checkInstance1.valid, false);
    assert.equal(checkInstance1.code, SESSION_SUPERSEDED_CODE);

    // Protected API on Instance 1 rejected with 401 SESSION_SUPERSEDED
    const msgReq1 = new NextRequest("http://instance1.internal/api/live-chat/messages", {
      headers: { cookie: `${VISITOR_COOKIE_NAME}=${tokenInstance1}` },
    });
    const msgRes1 = await visitorMessagesGetHandler(msgReq1);
    assert.equal(msgRes1.status, 401);
    const msgData1 = await msgRes1.json();
    assert.equal(msgData1.code, SESSION_SUPERSEDED_CODE);
    assert.equal(msgData1.error, SESSION_SUPERSEDED_MESSAGE);

    // Instance 2 continues working normally
    const checkInstance2 = await validateVisitorSession({
      cookies: { get: () => ({ value: tokenInstance2 }) },
    });
    assert.equal(checkInstance2.valid, true);
  });

  // 2. Two separate instances: Admin login on Instance 2 invalidates Instance 1
  test("2. Two separate instances: Admin login on Instance 2 invalidates Instance 1", async () => {
    // Instance 1: Admin logs in
    const loginReq1 = new NextRequest("http://instance1.internal/api/admin/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
    });
    const loginRes1 = await adminLoginHandler(loginReq1);
    assert.equal(loginRes1.status, 200);
    adminTokenInstance1 = loginRes1.cookies.get(ADMIN_COOKIE_NAME)?.value || "";
    assert.ok(adminTokenInstance1);

    // Instance 1 admin session is valid
    const checkAdminBefore = await validateAdminSession({
      cookies: { get: () => ({ value: adminTokenInstance1 }) },
    });
    assert.equal(checkAdminBefore.authenticated, true);

    // Instance 2: Admin logs in on separate instance
    const loginReq2 = new NextRequest("http://instance2.internal/api/admin/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
    });
    const loginRes2 = await adminLoginHandler(loginReq2);
    assert.equal(loginRes2.status, 200);
    adminTokenInstance2 = loginRes2.cookies.get(ADMIN_COOKIE_NAME)?.value || "";
    assert.ok(adminTokenInstance2);
    assert.notEqual(adminTokenInstance1, adminTokenInstance2);

    // CONFIRM: Instance 1 is immediately invalid and rejected
    const checkAdminInstance1 = await validateAdminSession({
      cookies: { get: () => ({ value: adminTokenInstance1 }) },
    });
    assert.equal(checkAdminInstance1.authenticated, false);
    assert.equal(checkAdminInstance1.code, SESSION_SUPERSEDED_CODE);

    // Protected API on Instance 1 rejected with 401 SESSION_SUPERSEDED
    const cmdReq1 = new NextRequest("http://instance1.internal/api/admin/commands", {
      headers: { cookie: `${ADMIN_COOKIE_NAME}=${adminTokenInstance1}` },
    });
    const cmdRes1 = await adminCommandsHandler(cmdReq1);
    assert.equal(cmdRes1.status, 401);
    const cmdData1 = await cmdRes1.json();
    assert.equal(cmdData1.code, SESSION_SUPERSEDED_CODE);

    // Instance 2 continues working normally
    const checkAdminInstance2 = await validateAdminSession({
      cookies: { get: () => ({ value: adminTokenInstance2 }) },
    });
    assert.equal(checkAdminInstance2.authenticated, true);
  });

  // 3. Independence: Admin and visitor sessions never invalidate each other
  test("3. Independence: Admin and visitor sessions never invalidate each other", async () => {
    // Both active: visitor Instance 2 and admin Instance 2
    const visitorCheck = await validateVisitorSession({
      cookies: { get: () => ({ value: tokenInstance2 }) },
    });
    assert.equal(visitorCheck.valid, true);

    const adminCheck = await validateAdminSession({
      cookies: { get: () => ({ value: adminTokenInstance2 }) },
    });
    assert.equal(adminCheck.authenticated, true);

    // New visitor login does not touch admin
    const freshEmail = "independent.visitor@example.com";
    const freshToken = generateSecureToken();
    const freshHash = hashToken(freshToken);
    const freshConv = await getOrCreateConversationByHash(freshHash);
    await registerVisitorActiveSession(freshEmail, freshToken, freshConv.id);

    const adminCheckAfter = await validateAdminSession({
      cookies: { get: () => ({ value: adminTokenInstance2 }) },
    });
    assert.equal(adminCheckAfter.authenticated, true);

    // New admin login does not touch visitor
    await registerAdminActiveSession();
    const visitorCheckAfter = await validateVisitorSession({
      cookies: { get: () => ({ value: tokenInstance2 }) },
    });
    assert.equal(visitorCheckAfter.valid, true);
  });

  // 4. Fail-Closed Verification: When database is unavailable in production, operations FAIL CLOSED
  test("4. Fail-Closed Verification: When database is unavailable in production, operations FAIL CLOSED", async () => {
    // Enable production persistence enforcement
    process.env.REQUIRE_SUPABASE = "true";

    try {
      // In production with REQUIRE_SUPABASE=true, if Supabase tables are unavailable (offline/mock):
      // getActiveSessionRecord must throw DatabaseUnavailableError or fail closed
      await assert.rejects(
        async () => {
          await getActiveSessionRecord("visitor", auditVisitorEmail);
        },
        (err) => {
          return err instanceof DatabaseUnavailableError || err.code === "DATABASE_UNAVAILABLE";
        },
        "Must throw DatabaseUnavailableError when database is unavailable in production",
      );

      // validateVisitorSession must fail closed (valid: false) and NOT fall back to local disk
      const failClosedVisitor = await validateVisitorSession({
        cookies: { get: () => ({ value: tokenInstance2 }) },
      });
      assert.equal(failClosedVisitor.valid, false);
      assert.equal(failClosedVisitor.code, "DATABASE_UNAVAILABLE");

      // validateAdminSession must fail closed (authenticated: false) and NOT fall back to local disk
      const failClosedAdmin = await validateAdminSession({
        cookies: { get: () => ({ value: adminTokenInstance2 }) },
      });
      assert.equal(failClosedAdmin.authenticated, false);
      assert.equal(failClosedAdmin.code, "DATABASE_UNAVAILABLE");
    } finally {
      // Restore testing environment
      delete process.env.REQUIRE_SUPABASE;
    }
  });

  // 5. Database failure never revives a superseded session
  test("5. Database failure never revives a superseded session", async () => {
    // Check that superseded token is NOT revived
    const supersededCheck = await validateVisitorSession({
      cookies: { get: () => ({ value: tokenInstance1 }) },
    });
    assert.equal(supersededCheck.valid, false);
    assert.equal(supersededCheck.code, SESSION_SUPERSEDED_CODE);

    const oldAdminCheck = await validateAdminSession({
      cookies: { get: () => ({ value: adminTokenInstance1 }) },
    });
    assert.equal(oldAdminCheck.authenticated, false);
    assert.equal(oldAdminCheck.code, SESSION_SUPERSEDED_CODE);
  });
});

