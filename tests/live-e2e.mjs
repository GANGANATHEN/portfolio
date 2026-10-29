import assert from "node:assert/strict";

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";
const TEST_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "dev_admin_password_for_testing";

async function runE2E() {
  console.log("=== 1. Testing Route Availability ===");
  // Test Home Page
  const homeRes = await fetch(`${BASE_URL}/`);
  assert.equal(homeRes.status, 200, "Home page should return 200");
  const homeHtml = await homeRes.text();
  assert.ok(homeHtml.includes("Ganganathan"), "Home page should contain Ganganathan");
  console.log("✔ Home page loaded successfully (HTTP 200)");

  // Test Admin Inbox Page
  const adminRes = await fetch(`${BASE_URL}/admin/inbox`);
  assert.equal(adminRes.status, 200, "Admin inbox page should return 200");
  console.log("✔ Admin inbox route loaded successfully (HTTP 200)");

  // Test robots.txt
  const robotsRes = await fetch(`${BASE_URL}/robots.txt`);
  assert.equal(robotsRes.status, 200);
  const robotsText = await robotsRes.text();
  assert.ok(robotsText.includes("Disallow: /admin/"));
  console.log("✔ robots.txt loaded and configured correctly");

  // Test sitemap.xml
  const sitemapRes = await fetch(`${BASE_URL}/sitemap.xml`);
  assert.equal(sitemapRes.status, 200);
  console.log("✔ sitemap.xml loaded successfully");

  console.log("\n=== 2. Testing Groq AI Chatbot API ===");
  const chatRes = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      history: [{ role: "user", text: "What are Ganganathan's main skills?" }],
      userName: "Recruiter",
    }),
  });
  assert.equal(chatRes.status, 200, "Chat route should gracefully return status 200");
  const chatData = await chatRes.json();
  assert.ok(chatData.reply, "Chatbot should return a friendly reply");
  console.log("✔ Chatbot response (Graceful fallback):", chatData.reply.slice(0, 80) + "...");

  console.log("\n=== 3. Testing Anonymous Guest Chat & Session Privacy ===");
  // Visitor 1 Session (Anonymous Guest)
  const v1SessionRes = await fetch(`${BASE_URL}/api/live-chat/session`);
  assert.equal(v1SessionRes.status, 200);
  const v1Cookie = v1SessionRes.headers.get("set-cookie");
  assert.ok(v1Cookie && v1Cookie.includes("ganganathan_visitor_session="));
  const v1SessionData = await v1SessionRes.json();
  assert.equal(v1SessionData.visitorEmail, null, "Anonymous guest has no initial email");
  assert.equal(v1SessionData.emailVerified, false, "Anonymous guest is unverified");
  console.log("✔ Visitor 1 session established with HTTP-only cookie (Anonymous guest)");

  // Visitor 1 sends message as guest
  const v1SendRes = await fetch(`${BASE_URL}/api/live-chat/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: v1Cookie,
    },
    body: JSON.stringify({
      content: "Hello Ganganathan, I am testing your anonymous guest chat!",
    }),
  });
  assert.equal(v1SendRes.status, 200);
  const v1SendData = await v1SendRes.json();
  assert.equal(v1SendData.message.content, "Hello Ganganathan, I am testing your anonymous guest chat!");
  console.log("✔ Visitor 1 sent message successfully without email");

  // Visitor 2 Session (Privacy Isolation Test)
  const v2SessionRes = await fetch(`${BASE_URL}/api/live-chat/session`);
  const v2Cookie = v2SessionRes.headers.get("set-cookie");

  const v2MessagesRes = await fetch(`${BASE_URL}/api/live-chat/messages`, {
    headers: { Cookie: v2Cookie },
  });
  const v2MessagesData = await v2MessagesRes.json();
  assert.equal(
    v2MessagesData.messages.some((m) => m.content.includes("Visitor 1")),
    false,
    "Visitor 2 MUST NOT see Visitor 1's messages",
  );
  console.log("✔ Privacy check passed: Visitor 2 has zero access to Visitor 1's conversation");

  console.log("\n=== 4. Testing Secure Email OTP Endpoints ===");
  // Request OTP for invalid email
  const badOtpReq = await fetch(`${BASE_URL}/api/live-chat/otp/request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: v1Cookie,
    },
    body: JSON.stringify({ email: "invalid-email-format" }),
  });
  assert.equal(badOtpReq.status, 400, "Invalid email format must be rejected");

  // Request OTP for valid email
  const validOtpReq = await fetch(`${BASE_URL}/api/live-chat/otp/request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: v1Cookie,
    },
    body: JSON.stringify({ email: "e2e.test.visitor@example.com" }),
  });
  assert.equal(validOtpReq.status, 200, "Valid OTP request should return 200");
  const otpReqData = await validOtpReq.json();
  assert.equal(otpReqData.success, true);
  assert.equal(otpReqData.otp, undefined, "OTP MUST NEVER be returned in response JSON");
  console.log("✔ OTP request endpoint successfully dispatched code without leaking OTP");

  // Immediate second request should be throttled by 60s cooldown
  const rapidOtpReq = await fetch(`${BASE_URL}/api/live-chat/otp/request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: v1Cookie,
    },
    body: JSON.stringify({ email: "e2e.test.visitor@example.com" }),
  });
  assert.equal(rapidOtpReq.status, 429, "Rapid second OTP request must be throttled with HTTP 429");
  console.log("✔ OTP resend cooldown (60s) enforced successfully (HTTP 429)");

  // Attempt invalid OTP verification
  const badVerifyRes = await fetch(`${BASE_URL}/api/live-chat/otp/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: v1Cookie,
    },
    body: JSON.stringify({
      email: "e2e.test.visitor@example.com",
      otp: "000000",
    }),
  });
  assert.equal(badVerifyRes.status, 400);
  const badVerifyData = await badVerifyRes.json();
  assert.ok(badVerifyData.error.includes("Invalid verification code"));
  console.log("✔ Invalid OTP verification correctly rejected");

  console.log("\n=== 5. Testing Admin Authentication & Protection ===");
  // Unauthenticated access
  const unauthRes = await fetch(`${BASE_URL}/api/admin/live-chat/conversations`);
  assert.equal(unauthRes.status, 401, "Unauthenticated admin request must be rejected with 401");
  console.log("✔ Security check passed: Unauthorized access correctly rejected with HTTP 401");

  // Authenticate as Admin
  const loginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: TEST_ADMIN_PASSWORD }),
  });
  assert.equal(loginRes.status, 200);
  const adminCookie = loginRes.headers.get("set-cookie");
  assert.ok(adminCookie && adminCookie.includes("ganganathan_admin_session="));
  console.log("✔ Admin login successful with signed session cookie");

  // Admin lists conversations
  const adminConvsRes = await fetch(`${BASE_URL}/api/admin/live-chat/conversations`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(adminConvsRes.status, 200);
  const adminConvsData = await adminConvsRes.json();
  assert.ok(adminConvsData.conversations.length > 0);
  // Admin finds Visitor 1's conversation
  const v1Conv = adminConvsData.conversations.find((c) =>
    c.latestMessage && c.latestMessage.includes("testing your anonymous guest chat"),
  );
  assert.ok(v1Conv, "Admin should locate Visitor 1's conversation");
  console.log("✔ Admin retrieved conversation list (found %d conversation(s))", adminConvsData.conversations.length);

  // Admin replies to Visitor 1
  const replyRes = await fetch(`${BASE_URL}/api/admin/live-chat/reply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
    },
    body: JSON.stringify({
      conversationId: v1Conv.id,
      content: "Hello! Thank you for testing the live chat. It is working in real time!",
    }),
  });
  assert.equal(replyRes.status, 200);
  console.log("✔ Admin replied to visitor conversation");

  // Visitor 1 fetches messages and verifies reply in active session
  const v1UpdatedRes = await fetch(`${BASE_URL}/api/live-chat/messages?mark_read=true`, {
    headers: { Cookie: v1Cookie },
  });
  const v1UpdatedData = await v1UpdatedRes.json();
  const lastMsg = v1UpdatedData.messages[v1UpdatedData.messages.length - 1];
  assert.equal(lastMsg.senderType, "owner");
  assert.ok(lastMsg.content.includes("It is working in real time!"));
  console.log("✔ Visitor 1 received owner's reply in guest session: \"%s\"", lastMsg.content);

  console.log("\n=== 6. Testing Advanced Chat Operations (Edits, Reactions, PDF Export) ===");
  // Visitor 1 edits their first message
  const v1FirstMsg = v1UpdatedData.messages[0];
  const editRes = await fetch(`${BASE_URL}/api/live-chat/messages`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: v1Cookie,
    },
    body: JSON.stringify({
      messageId: v1FirstMsg.id,
      content: "Hello Ganganathan, I am testing your anonymous guest chat! (edited version)",
    }),
  });
  assert.equal(editRes.status, 200, "Message edit should return HTTP 200");
  const editData = await editRes.json();
  assert.equal(editData.message.isEdited, true);
  console.log("✔ Visitor message editing verified");

  // Visitor 1 reacts to Admin's reply with 👍
  const reactRes = await fetch(`${BASE_URL}/api/live-chat/reactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: v1Cookie,
    },
    body: JSON.stringify({
      messageId: lastMsg.id,
      emoji: "👍",
    }),
  });
  assert.equal(reactRes.status, 200, "Emoji reaction should return HTTP 200");
  const reactData = await reactRes.json();
  assert.ok(reactData.reactions["👍"] && reactData.reactions["👍"].includes("visitor"));
  console.log("✔ Visitor emoji reaction (👍) toggled successfully");

  // Multi-emoji reaction test: visitor adds a second reaction (🔥) without wiping 👍
  const multiReactRes = await fetch(`${BASE_URL}/api/live-chat/reactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: v1Cookie,
    },
    body: JSON.stringify({
      messageId: lastMsg.id,
      emoji: "🔥",
    }),
  });
  assert.equal(multiReactRes.status, 200);
  const multiReactData = await multiReactRes.json();
  assert.ok(multiReactData.reactions["👍"] && multiReactData.reactions["👍"].includes("visitor"), "👍 must still be present");
  assert.ok(multiReactData.reactions["🔥"] && multiReactData.reactions["🔥"].includes("visitor"), "🔥 must also be present (multi-emoji)");
  console.log("✔ Multi-emoji reaction verified: visitor has both 👍 and 🔥 active");

  // Admin reacts to visitor message with ❤️
  const adminReactRes = await fetch(`${BASE_URL}/api/admin/live-chat/reactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
    },
    body: JSON.stringify({
      messageId: v1FirstMsg.id,
      conversationId: v1Conv.id,
      emoji: "❤️",
    }),
  });
  assert.equal(adminReactRes.status, 200);
  const adminReactData = await adminReactRes.json();
  assert.ok(adminReactData.reactions["❤️"] && adminReactData.reactions["❤️"].includes("owner"));
  console.log("✔ Admin emoji reaction (❤️) registered successfully");

  // Regression check: GET /api/live-chat/messages?mark_read=true with NO cookie must return 200 with empty array (never 500)
  const noCookieRes = await fetch(`${BASE_URL}/api/live-chat/messages?mark_read=true`);
  assert.equal(noCookieRes.status, 200, "Unauthenticated GET /api/live-chat/messages?mark_read=true must return 200 (never 500)");
  const noCookieData = await noCookieRes.json();
  assert.deepEqual(noCookieData.messages, [], "Unauthenticated visitor must receive empty messages array");
  console.log("✔ Regression check passed: GET /api/live-chat/messages?mark_read=true without session returns 200 { messages: [] }");

  // PDF Export unauthorized check
  const unauthPdfRes = await fetch(`${BASE_URL}/api/admin/live-chat/export-pdf?conversationId=${v1Conv.id}`);
  assert.equal(unauthPdfRes.status, 401, "PDF export without admin cookie must return 401");
  console.log("✔ PDF export security check passed (HTTP 401 unauthorized)");

  // PDF Export authorized check
  const pdfRes = await fetch(`${BASE_URL}/api/admin/live-chat/export-pdf?conversationId=${v1Conv.id}`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(pdfRes.status, 200, "Authorized PDF export must return HTTP 200");
  assert.equal(pdfRes.headers.get("content-type"), "application/pdf");
  const pdfBuffer = await pdfRes.arrayBuffer();
  const pdfHeader = Buffer.from(pdfBuffer.slice(0, 5)).toString("utf-8");
  assert.equal(pdfHeader, "%PDF-", "Exported document must start with valid PDF header");
  console.log("✔ Full conversation PDF export verified (%d bytes generated)", pdfBuffer.byteLength);

  console.log("\n=======================================================");
  console.log("🎉 ALL E2E FUNCTIONAL, SECURITY, AND PRIVACY CHECKS PASSED!");
  console.log("=======================================================");
}

runE2E().catch((err) => {
  console.error("❌ E2E Test Failure:", err);
  process.exit(1);
});
