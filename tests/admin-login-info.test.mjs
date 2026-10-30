import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET as loginInfoGet } from "../src/app/api/admin/login-info/route.ts";
import {
  ADMIN_COOKIE_NAME,
  generateSecureToken,
  hashToken,
} from "../src/lib/live-chat/security.ts";
import {
  registerAdminActiveSession,
  registerVisitorActiveSession,
} from "../src/lib/live-chat/session-registry.ts";

test("Admin Login Info & Session Monitoring Test Suite", async (t) => {
  await t.test("1. Unauthorized request without admin session is rejected with 401", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/login-info", {
      method: "GET",
    });

    const res = await loginInfoGet(req);
    assert.equal(res.status, 401, "Missing admin session must return 401");
  });

  await t.test("2. Authenticated admin request retrieves session history and summary KPIs", async () => {
    // Register admin session
    const { token: adminToken } = await registerAdminActiveSession({
      headers: {
        get: (h) => {
          if (h === "user-agent") return "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
          if (h === "x-forwarded-for") return "198.51.100.25";
          if (h === "x-vercel-ip-country") return "US";
          if (h === "x-vercel-ip-city") return "San Francisco";
          return null;
        },
      },
    });

    // Register a visitor session with telemetry
    const vToken = generateSecureToken();
    const vEmail = `visitor_telemetry_${Date.now()}@example.com`;
    await registerVisitorActiveSession(vEmail, vToken, null, {
      headers: {
        get: (h) => {
          if (h === "user-agent") return "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
          if (h === "x-forwarded-for") return "203.0.113.19";
          if (h === "x-vercel-ip-country") return "DE";
          if (h === "x-vercel-ip-city") return "Berlin";
          return null;
        },
      },
    });

    const req = new NextRequest("http://localhost:3000/api/admin/login-info", {
      method: "GET",
      headers: {
        cookie: `${ADMIN_COOKIE_NAME}=${adminToken}`,
      },
    });

    const res = await loginInfoGet(req);
    assert.equal(res.status, 200, "Authenticated admin should receive 200");
    const json = await res.json();
    assert.ok(json.success);
    assert.ok(Array.isArray(json.sessions));
    assert.ok(json.sessions.length > 0);
    assert.ok(json.summary);
    assert.ok(typeof json.summary.totalActive === "number");
    assert.ok(typeof json.summary.adminActive === "number");
    assert.ok(typeof json.summary.visitorActive === "number");
    assert.ok(json.pagination);
    assert.ok(json.pagination.total > 0);
  });

  await t.test("3. Filtering by accountType=visitor returns visitor sessions only", async () => {
    const { token: adminToken } = await registerAdminActiveSession();

    const req = new NextRequest("http://localhost:3000/api/admin/login-info?accountType=visitor", {
      method: "GET",
      headers: { cookie: `${ADMIN_COOKIE_NAME}=${adminToken}` },
    });

    const res = await loginInfoGet(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    for (const s of json.sessions) {
      assert.equal(s.accountType, "visitor");
    }
  });

  await t.test("4. Filtering by status=active returns active sessions only", async () => {
    const { token: adminToken } = await registerAdminActiveSession();

    const req = new NextRequest("http://localhost:3000/api/admin/login-info?status=active", {
      method: "GET",
      headers: { cookie: `${ADMIN_COOKIE_NAME}=${adminToken}` },
    });

    const res = await loginInfoGet(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    for (const s of json.sessions) {
      assert.equal(s.status, "active");
    }
  });

  await t.test("5. Multi-device superseding marks previous session status as superseded", async () => {
    const multiEmail = `supersede_telemetry_${Date.now()}@example.com`;
    const tokenA = generateSecureToken();
    const tokenB = generateSecureToken();

    // Login on Device A
    await registerVisitorActiveSession(multiEmail, tokenA);

    // Login on Device B
    await registerVisitorActiveSession(multiEmail, tokenB);

    const { token: adminToken } = await registerAdminActiveSession();
    const req = new NextRequest(`http://localhost:3000/api/admin/login-info?search=${encodeURIComponent(multiEmail)}`, {
      method: "GET",
      headers: { cookie: `${ADMIN_COOKIE_NAME}=${adminToken}` },
    });

    const res = await loginInfoGet(req);
    assert.equal(res.status, 200);
    const json = await res.json();

    const superseded = json.sessions.find((s) => s.status === "superseded" && s.accountId === multiEmail);
    assert.ok(superseded, "Previous session for this account must be marked superseded");
    assert.equal(superseded.invalidationReason, "superseded_by_new_login");
  });
});

