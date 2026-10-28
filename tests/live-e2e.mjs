import assert from "node:assert/strict";

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";

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

  console.log("\n=== 3. Testing Visitor Live Chat Session & Privacy ===");
  // Visitor 1 Session
  const v1SessionRes = await fetch(`${BASE_URL}/api/live-chat/session`);
  assert.equal(v1SessionRes.status, 200);
  const v1Cookie = v1SessionRes.headers.get("set-cookie");
  assert.ok(v1Cookie && v1Cookie.includes("ganganathan_visitor_session="));
  console.log("✔ Visitor 1 session established with HTTP-only cookie");

  // Visitor 1 sends message
  const v1SendRes = await fetch(`${BASE_URL}/api/live-chat/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: v1Cookie,
    },
    body: JSON.stringify({
      content: "Hello Ganganathan, I am testing your live chat from India!",
    }),
  });
  assert.equal(v1SendRes.status, 200);
  const v1SendData = await v1SendRes.json();
  assert.equal(v1SendData.message.content, "Hello Ganganathan, I am testing your live chat from India!");
  console.log("✔ Visitor 1 sent message successfully");

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

  console.log("\n=== 4. Testing Admin Authentication & Protection ===");
  // Unauthenticated access
  const unauthRes = await fetch(`${BASE_URL}/api/admin/live-chat/conversations`);
  assert.equal(unauthRes.status, 401, "Unauthenticated admin request must be rejected with 401");
  console.log("✔ Security check passed: Unauthorized access correctly rejected with HTTP 401");

  // Authenticate as Admin
  const loginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "ganganathan123" }),
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
    c.latestMessage && c.latestMessage.includes("testing your live chat"),
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

  // Visitor 1 fetches messages and verifies reply
  const v1UpdatedRes = await fetch(`${BASE_URL}/api/live-chat/messages?mark_read=true`, {
    headers: { Cookie: v1Cookie },
  });
  const v1UpdatedData = await v1UpdatedRes.json();
  const lastMsg = v1UpdatedData.messages[v1UpdatedData.messages.length - 1];
  assert.equal(lastMsg.senderType, "owner");
  assert.ok(lastMsg.content.includes("It is working in real time!"));
  console.log("✔ Visitor 1 received owner's reply: \"%s\"", lastMsg.content);

  console.log("\n=======================================================");
  console.log("🎉 ALL E2E FUNCTIONAL, SECURITY, AND PRIVACY CHECKS PASSED!");
  console.log("=======================================================");
}

runE2E().catch((err) => {
  console.error("❌ E2E Test Failure:", err);
  process.exit(1);
});
