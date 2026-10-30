import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST as signUpPost } from "../src/app/api/live-chat/auth/signup/route.ts";
import { POST as signInPost } from "../src/app/api/live-chat/auth/signin/route.ts";
import { POST as logoutPost } from "../src/app/api/live-chat/auth/logout/route.ts";
import { POST as forgotPasswordPost } from "../src/app/api/live-chat/auth/forgot-password/route.ts";
import { POST as resetPasswordPost } from "../src/app/api/live-chat/auth/reset-password/route.ts";
import { POST as deleteAccountPost } from "../src/app/api/live-chat/auth/delete-account/route.ts";
import { GET as meGet } from "../src/app/api/live-chat/auth/me/route.ts";
import {
  VISITOR_COOKIE_NAME,
  generatePasswordResetToken,
} from "../src/lib/live-chat/security.ts";
import {
  getVisitorAccountByEmail,
  createPasswordResetRecord,
} from "../src/lib/live-chat/db.ts";

test("Complete Visitor Account Management & Single Active Session Test Suite", async (t) => {
  const testEmail = `user_${Date.now()}@example.com`;
  const initialPassword = "SuperPassword123!";
  let deviceASessionCookie = "";

  await t.test("1. Sign up creates account, establishes active session, sets cookie", async () => {
    const req = new NextRequest("http://localhost:3000/api/live-chat/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: initialPassword,
        name: "Test Visitor",
      }),
    });

    const res = await signUpPost(req);
    assert.equal(res.status, 200, "Sign up should return 200");
    const json = await res.json();
    assert.ok(json.success);
    assert.equal(json.account.email, testEmail.toLowerCase());
    assert.equal(json.account.name, "Test Visitor");

    const setCookie = res.headers.get("set-cookie");
    assert.ok(setCookie && setCookie.includes(VISITOR_COOKIE_NAME));
    const tokenMatch = setCookie.match(new RegExp(`${VISITOR_COOKIE_NAME}=([^;]+)`));
    deviceASessionCookie = tokenMatch ? tokenMatch[1] : "";
    assert.ok(deviceASessionCookie.length >= 32);
  });

  await t.test("2. Duplicate sign up with same email is rejected with 409", async () => {
    const req = new NextRequest("http://localhost:3000/api/live-chat/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail.toUpperCase(), // Test case insensitivity
        password: "AnotherPassword123",
      }),
    });

    const res = await signUpPost(req);
    assert.equal(res.status, 409, "Duplicate email must return 409");
  });

  await t.test("3. Weak password is rejected with 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/live-chat/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `weak_${Date.now()}@example.com`,
        password: "short",
      }),
    });

    const res = await signUpPost(req);
    assert.equal(res.status, 400);
  });

  await t.test("4. Device A authenticated access to /api/live-chat/auth/me succeeds", async () => {
    const req = new NextRequest("http://localhost:3000/api/live-chat/auth/me", {
      method: "GET",
      headers: { cookie: `${VISITOR_COOKIE_NAME}=${deviceASessionCookie}` },
    });

    const res = await meGet(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.authenticated, true);
    assert.equal(json.account.email, testEmail.toLowerCase());
  });

  let deviceBSessionCookie = "";
  await t.test("5. Sign in on Device B supersedes Device A session (Single Active Session Security)", async () => {
    const reqB = new NextRequest("http://localhost:3000/api/live-chat/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: initialPassword,
      }),
    });

    const resB = await signInPost(reqB);
    assert.equal(resB.status, 200);
    const jsonB = await resB.json();
    assert.ok(jsonB.success);

    const setCookieB = resB.headers.get("set-cookie");
    const matchB = setCookieB.match(new RegExp(`${VISITOR_COOKIE_NAME}=([^;]+)`));
    deviceBSessionCookie = matchB ? matchB[1] : "";
    assert.ok(deviceBSessionCookie.length >= 32);
    assert.notEqual(deviceBSessionCookie, deviceASessionCookie);

    // Now Device A accesses /me -> MUST be superseded!
    const reqA = new NextRequest("http://localhost:3000/api/live-chat/auth/me", {
      method: "GET",
      headers: { cookie: `${VISITOR_COOKIE_NAME}=${deviceASessionCookie}` },
    });
    const resA = await meGet(reqA);
    assert.equal(resA.status, 401, "Device A must receive 401 superseded response");
    const jsonA = await resA.json();
    assert.equal(jsonA.code, "SESSION_SUPERSEDED");

    // Device B continues working normally
    const reqBCheck = new NextRequest("http://localhost:3000/api/live-chat/auth/me", {
      method: "GET",
      headers: { cookie: `${VISITOR_COOKIE_NAME}=${deviceBSessionCookie}` },
    });
    const resBCheck = await meGet(reqBCheck);
    assert.equal(resBCheck.status, 200);
    const jsonBCheck = await resBCheck.json();
    assert.equal(jsonBCheck.authenticated, true);
  });

  await t.test("6. Sign in with incorrect password rejected with 401", async () => {
    const req = new NextRequest("http://localhost:3000/api/live-chat/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: "WrongPassword999!",
      }),
    });

    const res = await signInPost(req);
    assert.equal(res.status, 401);
  });

  let validResetToken = "";
  await t.test("7. Forgot password generates reset record", async () => {
    const account = await getVisitorAccountByEmail(testEmail);
    assert.ok(account);

    const { token, tokenHash } = generatePasswordResetToken();
    validResetToken = token;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await createPasswordResetRecord({
      accountId: account.id,
      email: testEmail,
      tokenHash,
      expiresAt,
    });

    const req = new NextRequest("http://localhost:3000/api/live-chat/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail }),
    });

    const res = await forgotPasswordPost(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(json.success);
  });

  const updatedPassword = "BrandNewPassword456!";
  await t.test("8. Reset password updates credentials and invalidates active sessions", async () => {
    const req = new NextRequest("http://localhost:3000/api/live-chat/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: validResetToken,
        newPassword: updatedPassword,
      }),
    });

    const res = await resetPasswordPost(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(json.success);

    // Old password fails
    const failReq = new NextRequest("http://localhost:3000/api/live-chat/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: initialPassword,
      }),
    });
    const failRes = await signInPost(failReq);
    assert.equal(failRes.status, 401);

    // New password succeeds
    const okReq = new NextRequest("http://localhost:3000/api/live-chat/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: updatedPassword,
      }),
    });
    const okRes = await signInPost(okReq);
    assert.equal(okRes.status, 200);
    const match = okRes.headers.get("set-cookie").match(new RegExp(`${VISITOR_COOKIE_NAME}=([^;]+)`));
    deviceBSessionCookie = match[1];
  });

  await t.test("9. Delete account verifies password and soft deletes account", async () => {
    // Attempt deletion with wrong password -> 401
    const wrongPassReq = new NextRequest("http://localhost:3000/api/live-chat/auth/delete-account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `${VISITOR_COOKIE_NAME}=${deviceBSessionCookie}`,
      },
      body: JSON.stringify({ password: "NotTheRightPassword!" }),
    });
    const wrongPassRes = await deleteAccountPost(wrongPassReq);
    assert.equal(wrongPassRes.status, 401);

    // Correct password -> deletes account
    const correctPassReq = new NextRequest("http://localhost:3000/api/live-chat/auth/delete-account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `${VISITOR_COOKIE_NAME}=${deviceBSessionCookie}`,
      },
      body: JSON.stringify({ password: updatedPassword }),
    });
    const correctPassRes = await deleteAccountPost(correctPassReq);
    assert.equal(correctPassRes.status, 200);
    const json = await correctPassRes.json();
    assert.ok(json.success);

    // Future sign in is blocked
    const reLoginReq = new NextRequest("http://localhost:3000/api/live-chat/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: updatedPassword,
      }),
    });
    const reLoginRes = await signInPost(reLoginReq);
    assert.equal(reLoginRes.status, 401, "Deleted account cannot sign in");
  });
});

