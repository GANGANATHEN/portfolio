import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";

process.env.EMAIL_NOTIFICATION_COOLDOWN_MINUTES = "10";
process.env.OWNER_EMAIL = "ganganathan.dev@gmail.com";
process.env.RESEND_API_KEY = ""; // Simulation mode (no external network)
process.env.ADMIN_SECRET_KEY = "test_admin_secret_key_minimum_32_characters_long_for_security";
process.env.ADMIN_PASSWORD = "test_admin_password_2026";

import {
  generateSecureToken,
  hashToken,
  generateOtp,
  hashOtp,
  VISITOR_COOKIE_NAME,
  ADMIN_COOKIE_NAME,
  SESSION_SUPERSEDED_CODE,
  SESSION_SUPERSEDED_MESSAGE,
} from "../src/lib/live-chat/security.ts";

import {
  createEmailOtp,
  getOrCreateConversationByHash,
  addMessage,
  getMessages,
  reloadDurableStoreFromDiskForTesting,
  getActiveSessionRecord,
  isSessionTokenSuperseded,
} from "../src/lib/live-chat/db.ts";

import {
  registerAdminActiveSession,
  validateAdminSession,
  revokeAdminSession,
  registerVisitorActiveSession,
  validateVisitorSession,
  revokeVisitorSession,
} from "../src/lib/live-chat/session-registry.ts";

// API Route Handlers
import { POST as adminLoginHandler } from "../src/app/api/admin/auth/login/route.ts";
import { POST as adminLogoutHandler } from "../src/app/api/admin/auth/logout/route.ts";
import { GET as adminCheckHandler } from "../src/app/api/admin/auth/check/route.ts";
import { GET as adminConversationsHandler } from "../src/app/api/admin/live-chat/conversations/route.ts";
import { GET as adminCommandsHandler } from "../src/app/api/admin/commands/route.ts";

import { GET as visitorSessionHandler } from "../src/app/api/live-chat/session/route.ts";
import {
  GET as visitorMessagesGetHandler,
  PATCH as visitorMessagesPatchHandler,
  DELETE as visitorMessagesDeleteHandler,
} from "../src/app/api/live-chat/messages/route.ts";
import { POST as visitorSendDirectHandler } from "../src/app/api/live-chat/send/route.ts";
import { POST as visitorVerifyOtpHandler } from "../src/app/api/live-chat/otp/verify/route.ts";
import { POST as visitorProfileHandler } from "../src/app/api/live-chat/profile/route.ts";
import { POST as visitorReactionsHandler } from "../src/app/api/live-chat/reactions/route.ts";

describe("Single Active Session Security Suite (Mandatory 12 Requirements)", () => {
  before(() => {
    // Reset test database store
    const dataDir = path.join(process.cwd(), ".data");
    const storeFile = path.join(dataDir, "live-chat-store.json");
    if (fs.existsSync(storeFile)) {
      try {
        fs.unlinkSync(storeFile);
      } catch {}
    }
  });

  const testEmail = "charlie.security@example.com";
  let tokenA = "";
  let tokenB = "";
  let adminTokenA = "";
  let adminTokenB = "";

  // 1. Visitor login on Device A creates an active session
  test("1. Visitor login on Device A creates an active session", async () => {
    tokenA = generateSecureToken();
    const hashA = hashToken(tokenA);
    const convA = await getOrCreateConversationByHash(hashA);

    // Create valid OTP for testEmail
    const otp = "123456";
    const otpHash = hashOtp(testEmail, otp);
    await createEmailOtp(
      convA.id,
      testEmail,
      otpHash,
      new Date(Date.now() + 600000).toISOString(),
      5,
    );

    // Device A verifies OTP
    const verifyReq = new NextRequest("http://localhost:3000/api/live-chat/otp/verify", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${VISITOR_COOKIE_NAME}=${tokenA}`,
      },
      body: JSON.stringify({ email: testEmail, otp }),
    });

    const verifyRes = await visitorVerifyOtpHandler(verifyReq);
    assert.equal(verifyRes.status, 200);
    const verifyData = await verifyRes.json();
    assert.equal(verifyData.emailVerified, true);
    assert.equal(verifyData.visitorEmail, testEmail);

    // Verify session registry record
    const activeSession = await getActiveSessionRecord("visitor", testEmail);
    assert.ok(activeSession);
    assert.equal(activeSession.isActive, true);
    assert.equal(activeSession.tokenHash, hashA);

    // Device A can access protected APIs
    const msgReq = new NextRequest("http://localhost:3000/api/live-chat/messages", {
      headers: { cookie: `${VISITOR_COOKIE_NAME}=${tokenA}` },
    });
    const msgRes = await visitorMessagesGetHandler(msgReq);
    assert.equal(msgRes.status, 200);
  });

  // 2. Visitor login on Device B invalidates Device A
  test("2. Visitor login on Device B invalidates Device A", async () => {
    tokenB = generateSecureToken();
    const hashB = hashToken(tokenB);
    const convB = await getOrCreateConversationByHash(hashB);

    // Create valid OTP for testEmail on Device B
    const otp = "654321";
    const otpHash = hashOtp(testEmail, otp);
    await createEmailOtp(
      convB.id,
      testEmail,
      otpHash,
      new Date(Date.now() + 600000).toISOString(),
      5,
    );

    // Device B verifies OTP
    const verifyReqB = new NextRequest("http://localhost:3000/api/live-chat/otp/verify", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${VISITOR_COOKIE_NAME}=${tokenB}`,
      },
      body: JSON.stringify({ email: testEmail, otp }),
    });

    const verifyResB = await visitorVerifyOtpHandler(verifyReqB);
    assert.equal(verifyResB.status, 200);

    // The single active session in registry must now be Device B (hashB)
    const activeSession = await getActiveSessionRecord("visitor", testEmail);
    assert.ok(activeSession);
    assert.equal(activeSession.isActive, true);
    assert.equal(activeSession.tokenHash, hashB);
  });

  // 3. Device A cannot access protected APIs after Device B login
  test("3. Device A cannot access protected APIs after Device B login", async () => {
    // 3a. Device A calling GET /api/live-chat/messages
    const msgReq = new NextRequest("http://localhost:3000/api/live-chat/messages", {
      headers: { cookie: `${VISITOR_COOKIE_NAME}=${tokenA}` },
    });
    const msgRes = await visitorMessagesGetHandler(msgReq);
    assert.equal(msgRes.status, 401);
    const msgData = await msgRes.json();
    assert.equal(msgData.code, SESSION_SUPERSEDED_CODE);
    assert.equal(msgData.error, SESSION_SUPERSEDED_MESSAGE);

    // 3b. Device A calling POST /api/live-chat/send
    const sendReq = new NextRequest("http://localhost:3000/api/live-chat/send", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${VISITOR_COOKIE_NAME}=${tokenA}`,
      },
      body: JSON.stringify({ content: "Unauthorized attempt from old device" }),
    });
    const sendRes = await visitorSendDirectHandler(sendReq);
    assert.equal(sendRes.status, 401);
    const sendData = await sendRes.json();
    assert.equal(sendData.code, SESSION_SUPERSEDED_CODE);

    // 3c. Device A calling POST /api/live-chat/reactions
    const reactReq = new NextRequest("http://localhost:3000/api/live-chat/reactions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${VISITOR_COOKIE_NAME}=${tokenA}`,
      },
      body: JSON.stringify({ messageId: "dummy-id", emoji: "👍" }),
    });
    const reactRes = await visitorReactionsHandler(reactReq);
    assert.equal(reactRes.status, 401);
    const reactData = await reactRes.json();
    assert.equal(reactData.code, SESSION_SUPERSEDED_CODE);

    // 3d. Device A calling POST /api/live-chat/profile
    const profReq = new NextRequest("http://localhost:3000/api/live-chat/profile", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${VISITOR_COOKIE_NAME}=${tokenA}`,
      },
      body: JSON.stringify({ name: "Hacked Profile" }),
    });
    const profRes = await visitorProfileHandler(profReq);
    assert.equal(profRes.status, 401);
    const profData = await profRes.json();
    assert.equal(profData.code, SESSION_SUPERSEDED_CODE);
  });

  // 4. Device A cannot refresh its invalidated session
  test("4. Device A cannot refresh its invalidated session", async () => {
    const sessionReq = new NextRequest("http://localhost:3000/api/live-chat/session", {
      headers: { cookie: `${VISITOR_COOKIE_NAME}=${tokenA}` },
    });
    const sessionRes = await visitorSessionHandler(sessionReq);
    assert.equal(sessionRes.status, 401);

    const sessionData = await sessionRes.json();
    assert.equal(sessionData.code, SESSION_SUPERSEDED_CODE);
    assert.equal(sessionData.error, SESSION_SUPERSEDED_MESSAGE);

    // Must set-cookie clearing the cookie
    const setCookie = sessionRes.headers.get("set-cookie");
    assert.ok(setCookie);
    assert.ok(setCookie.includes(`${VISITOR_COOKIE_NAME}=`));
    assert.ok(setCookie.includes("Max-Age=0") || setCookie.includes("Expires="));
  });

  // 5. Device B continues working normally
  test("5. Device B continues working normally", async () => {
    // 5a. GET /api/live-chat/session succeeds for Device B
    const sessionReqB = new NextRequest("http://localhost:3000/api/live-chat/session", {
      headers: { cookie: `${VISITOR_COOKIE_NAME}=${tokenB}` },
    });
    const sessionResB = await visitorSessionHandler(sessionReqB);
    assert.equal(sessionResB.status, 200);
    const sessionDataB = await sessionResB.json();
    assert.equal(sessionDataB.emailVerified, true);
    assert.equal(sessionDataB.visitorEmail, testEmail);

    // 5b. POST /api/live-chat/send succeeds for Device B
    const sendReqB = new NextRequest("http://localhost:3000/api/live-chat/send", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${VISITOR_COOKIE_NAME}=${tokenB}`,
      },
      body: JSON.stringify({ content: "Legitimate message from active Device B" }),
    });
    const sendResB = await visitorSendDirectHandler(sendReqB);
    assert.equal(sendResB.status, 200);
    const sendDataB = await sendResB.json();
    assert.ok(sendDataB.message);
    assert.equal(sendDataB.message.content, "Legitimate message from active Device B");

    // 5c. GET /api/live-chat/messages succeeds for Device B
    const msgReqB = new NextRequest("http://localhost:3000/api/live-chat/messages", {
      headers: { cookie: `${VISITOR_COOKIE_NAME}=${tokenB}` },
    });
    const msgResB = await visitorMessagesGetHandler(msgReqB);
    assert.equal(msgResB.status, 200);
    const msgDataB = await msgResB.json();
    assert.ok(Array.isArray(msgDataB.messages));
    assert.ok(msgDataB.messages.some((m) => m.content === "Legitimate message from active Device B"));
  });

  // 6. Admin login on Device B invalidates the previous admin session
  test("6. Admin login on Device B invalidates the previous admin session", async () => {
    // Admin logs in on Device A
    const loginReqA = new NextRequest("http://localhost:3000/api/admin/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
    });
    const loginResA = await adminLoginHandler(loginReqA);
    assert.equal(loginResA.status, 200);
    const cookieAHeader = loginResA.headers.get("set-cookie") || "";
    const matchA = cookieAHeader.match(new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`));
    assert.ok(matchA);
    adminTokenA = loginResA.cookies.get(ADMIN_COOKIE_NAME)?.value || decodeURIComponent(matchA[1]);

    // Admin Device A is authenticated
    const checkReqA = new NextRequest("http://localhost:3000/api/admin/auth/check", {
      headers: { cookie: `${ADMIN_COOKIE_NAME}=${adminTokenA}` },
    });
    const checkResA = await adminCheckHandler(checkReqA);
    assert.equal(checkResA.status, 200);
    const checkDataA = await checkResA.json();
    assert.equal(checkDataA.authenticated, true);

    // Admin now logs in on Device B
    const loginReqB = new NextRequest("http://localhost:3000/api/admin/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
    });
    const loginResB = await adminLoginHandler(loginReqB);
    assert.equal(loginResB.status, 200);
    const cookieBHeader = loginResB.headers.get("set-cookie") || "";
    const matchB = cookieBHeader.match(new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`));
    assert.ok(matchB);
    adminTokenB = loginResB.cookies.get(ADMIN_COOKIE_NAME)?.value || decodeURIComponent(matchB[1]);
    assert.notEqual(adminTokenA, adminTokenB);

    // Admin Device B is active
    const checkReqB = new NextRequest("http://localhost:3000/api/admin/auth/check", {
      headers: { cookie: `${ADMIN_COOKIE_NAME}=${adminTokenB}` },
    });
    const checkResB = await adminCheckHandler(checkReqB);
    assert.equal(checkResB.status, 200);
    const checkDataB = await checkResB.json();
    assert.equal(checkDataB.authenticated, true);
  });

  // 7. Old admin session cannot access admin APIs
  test("7. Old admin session cannot access admin APIs", async () => {
    // 7a. GET /api/admin/auth/check with adminTokenA
    const checkReqA = new NextRequest("http://localhost:3000/api/admin/auth/check", {
      headers: { cookie: `${ADMIN_COOKIE_NAME}=${adminTokenA}` },
    });
    const checkResA = await adminCheckHandler(checkReqA);
    assert.equal(checkResA.status, 401);
    const checkDataA = await checkResA.json();
    assert.equal(checkDataA.authenticated, false);
    assert.equal(checkDataA.code, SESSION_SUPERSEDED_CODE);
    assert.equal(checkDataA.error, SESSION_SUPERSEDED_MESSAGE);

    // Cookie must be cleared on response
    const setCookie = checkResA.headers.get("set-cookie");
    assert.ok(setCookie);
    assert.ok(setCookie.includes(`${ADMIN_COOKIE_NAME}=`));

    // 7b. GET /api/admin/live-chat/conversations with adminTokenA
    const convReqA = new NextRequest("http://localhost:3000/api/admin/live-chat/conversations", {
      headers: { cookie: `${ADMIN_COOKIE_NAME}=${adminTokenA}` },
    });
    const convResA = await adminConversationsHandler(convReqA);
    assert.equal(convResA.status, 401);
    const convDataA = await convResA.json();
    assert.equal(convDataA.code, SESSION_SUPERSEDED_CODE);

    // 7c. GET /api/admin/commands with adminTokenA
    const cmdReqA = new NextRequest("http://localhost:3000/api/admin/commands", {
      headers: { cookie: `${ADMIN_COOKIE_NAME}=${adminTokenA}` },
    });
    const cmdResA = await adminCommandsHandler(cmdReqA);
    assert.equal(cmdResA.status, 401);
    const cmdDataA = await cmdResA.json();
    assert.equal(cmdDataA.code, SESSION_SUPERSEDED_CODE);
  });

  // 8. Admin and visitor sessions do not invalidate each other
  test("8. Admin and visitor sessions do not invalidate each other", async () => {
    // Device B visitor session is active
    const visitorSessionBefore = await validateVisitorSession({
      cookies: { get: () => ({ value: tokenB }) },
    });
    assert.equal(visitorSessionBefore.valid, true);

    // New admin login occurs
    const adminLoginRes = await adminLoginHandler(
      new NextRequest("http://localhost:3000/api/admin/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
      }),
    );
    assert.equal(adminLoginRes.status, 200);

    // Visitor Device B session is STILL active
    const visitorSessionAfter = await validateVisitorSession({
      cookies: { get: () => ({ value: tokenB }) },
    });
    assert.equal(visitorSessionAfter.valid, true);

    // Another visitor logs in on different email
    const otherEmail = "other.visitor@example.com";
    const otherToken = generateSecureToken();
    const otherHash = hashToken(otherToken);
    const otherConv = await getOrCreateConversationByHash(otherHash);
    await registerVisitorActiveSession(otherEmail, otherToken, otherConv.id);

    // Neither admin session nor Device B session are affected
    const newAdminToken = adminLoginRes.cookies.get(ADMIN_COOKIE_NAME)?.value || "";
    const adminCheck = await validateAdminSession({
      cookies: {
        get: (name) => ({ value: name === ADMIN_COOKIE_NAME ? newAdminToken : undefined }),
      },
    });
    assert.equal(adminCheck.authenticated, true);

    const visitorCheck = await validateVisitorSession({
      cookies: { get: () => ({ value: tokenB }) },
    });
    assert.equal(visitorCheck.valid, true);
  });

  // 9. Simultaneous login requests do not leave multiple active sessions
  test("9. Simultaneous login requests do not leave multiple active sessions", async () => {
    const concurrentEmail = "race.test@example.com";
    const token1 = generateSecureToken();
    const token2 = generateSecureToken();

    // Two simultaneous session registrations
    await Promise.all([
      registerVisitorActiveSession(concurrentEmail, token1),
      registerVisitorActiveSession(concurrentEmail, token2),
    ]);

    const activeSession = await getActiveSessionRecord("visitor", concurrentEmail);
    assert.ok(activeSession);
    assert.equal(activeSession.isActive, true);

    // Exactly one token is the active token
    const isToken1Active = activeSession.tokenHash === hashToken(token1);
    const isToken2Active = activeSession.tokenHash === hashToken(token2);
    assert.equal(isToken1Active !== isToken2Active, true, "Exactly one token must be the active token");

    // The other token must be invalidated
    const losingToken = isToken1Active ? token2 : token1;
    const losingCheck = await validateVisitorSession({
      cookies: { get: () => ({ value: losingToken }) },
    });
    assert.equal(losingCheck.valid, false);
    assert.equal(losingCheck.code, SESSION_SUPERSEDED_CODE);
  });

  // 10. Session invalidation survives server-side instance changes or simulated restart
  test("10. Session invalidation survives server-side instance changes or simulated restart", async () => {
    // Simulated restart by re-initializing store from disk
    reloadDurableStoreFromDiskForTesting();

    // Device A's superseded status must persist
    const checkA = await validateVisitorSession({
      cookies: { get: () => ({ value: tokenA }) },
    });
    assert.equal(checkA.valid, false);
    assert.equal(checkA.code, SESSION_SUPERSEDED_CODE);

    // Device B's active status must persist
    const checkB = await validateVisitorSession({
      cookies: { get: () => ({ value: tokenB }) },
    });
    assert.equal(checkB.valid, true);

    // Old admin session's superseded status must persist
    const checkAdminA = await validateAdminSession({
      cookies: { get: () => ({ value: adminTokenA }) },
    });
    assert.equal(checkAdminA.authenticated, false);
    assert.equal(checkAdminA.code, SESSION_SUPERSEDED_CODE);
  });

  // 11. Normal logout invalidates the active session
  test("11. Normal logout invalidates the active session", async () => {
    // 11a. Admin logout
    const logoutReq = new NextRequest("http://localhost:3000/api/admin/auth/logout", {
      method: "POST",
      headers: { cookie: `${ADMIN_COOKIE_NAME}=${adminTokenB}` },
    });
    const logoutRes = await adminLogoutHandler(logoutReq);
    assert.equal(logoutRes.status, 200);

    // Subsequent check must return 401
    const checkPostLogout = await adminCheckHandler(
      new NextRequest("http://localhost:3000/api/admin/auth/check", {
        headers: { cookie: `${ADMIN_COOKIE_NAME}=${adminTokenB}` },
      }),
    );
    assert.equal(checkPostLogout.status, 401);

    // 11b. Visitor logout
    const visitorLogoutReq = new NextRequest("http://localhost:3000/api/live-chat/profile", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${VISITOR_COOKIE_NAME}=${tokenB}`,
      },
      body: JSON.stringify({ action: "logout" }),
    });
    const visitorLogoutRes = await visitorProfileHandler(visitorLogoutReq);
    assert.equal(visitorLogoutRes.status, 200);

    // Subsequent visitor request with tokenB must be rejected
    const checkVisitorPostLogout = await validateVisitorSession({
      cookies: { get: () => ({ value: tokenB }) },
    });
    assert.equal(checkVisitorPostLogout.valid, false);
  });

  // 12. Existing email verification and conversation continuity continue working
  test("12. Existing email verification and conversation continuity continue working", async () => {
    const returningEmail = "continuity.user@example.com";
    const session1 = generateSecureToken();
    const hash1 = hashToken(session1);
    const conv1 = await getOrCreateConversationByHash(hash1, "Continuity User");

    // Anonymous message
    await addMessage({
      conversationId: conv1.id,
      senderType: "visitor",
      content: "Message before verification",
    });

    // Verify email
    const otp = "889900";
    await createEmailOtp(
      conv1.id,
      returningEmail,
      hashOtp(returningEmail, otp),
      new Date(Date.now() + 600000).toISOString(),
      5,
    );

    const verifyReq1 = new NextRequest("http://localhost:3000/api/live-chat/otp/verify", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${VISITOR_COOKIE_NAME}=${session1}`,
      },
      body: JSON.stringify({ email: returningEmail, otp }),
    });
    const verifyRes1 = await visitorVerifyOtpHandler(verifyReq1);
    assert.equal(verifyRes1.status, 200);

    // Later session on Device 2 for returning user restores history
    const session2 = generateSecureToken();
    const hash2 = hashToken(session2);
    const conv2 = await getOrCreateConversationByHash(hash2, "New Session User");

    const otp2 = "112233";
    await createEmailOtp(
      conv2.id,
      returningEmail,
      hashOtp(returningEmail, otp2),
      new Date(Date.now() + 600000).toISOString(),
      5,
    );

    const verifyReq2 = new NextRequest("http://localhost:3000/api/live-chat/otp/verify", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${VISITOR_COOKIE_NAME}=${session2}`,
      },
      body: JSON.stringify({ email: returningEmail, otp: otp2 }),
    });
    const verifyRes2 = await visitorVerifyOtpHandler(verifyReq2);
    assert.equal(verifyRes2.status, 200);
    const verifyData2 = await verifyRes2.json();
    assert.equal(verifyData2.restored, true);

    // Messages are restored in session 2
    const messages2 = await getMessages(verifyData2.conversationId);
    assert.ok(messages2.some((m) => m.content === "Message before verification"));

    // Session 1 is superseded
    const checkSession1 = await validateVisitorSession({
      cookies: { get: () => ({ value: session1 }) },
    });
    assert.equal(checkSession1.valid, false);
    assert.equal(checkSession1.code, SESSION_SUPERSEDED_CODE);

    // Session 2 is active
    const checkSession2 = await validateVisitorSession({
      cookies: { get: () => ({ value: session2 }) },
    });
    assert.equal(checkSession2.valid, true);
  });
});
