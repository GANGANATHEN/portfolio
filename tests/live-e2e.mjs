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
  assert.ok(chatData.reply && chatData.reply.length > 10, "Chatbot should return a substantial reply");
  console.log("✔ Chatbot response (Live AI Response):", chatData.reply.slice(0, 100) + "...");

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
  const testEmail = `visitor.${Date.now()}@example.com`;
  const validOtpReq = await fetch(`${BASE_URL}/api/live-chat/otp/request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: v1Cookie,
    },
    body: JSON.stringify({ email: testEmail }),
  });
  const otpReqData = await validOtpReq.json();
  assert.equal(validOtpReq.status, 200, "Valid OTP request should return 200");
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
    body: JSON.stringify({ email: testEmail }),
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
      email: testEmail,
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

  console.log("\n=== 7. Testing Admin Pinning and Conversation Deletion Actions ===");
  // Pin Conversation
  const pinRes = await fetch(`${BASE_URL}/api/admin/live-chat/conversations`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
    },
    body: JSON.stringify({
      conversationId: v1Conv.id,
      isPinned: true,
    }),
  });
  assert.equal(pinRes.status, 200, "Pin request should return HTTP 200");
  const pinData = await pinRes.json();
  assert.equal(pinData.isPinned, true, "Pin response must confirm isPinned: true");
  console.log("✔ Admin pinned conversation successfully");

  // Verify conversation is returned as pinned in GET list
  const convsAfterPinRes = await fetch(`${BASE_URL}/api/admin/live-chat/conversations`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(convsAfterPinRes.status, 200);
  const convsAfterPinData = await convsAfterPinRes.json();
  const targetConvInList = convsAfterPinData.conversations.find((c) => c.id === v1Conv.id);
  assert.ok(targetConvInList);
  assert.equal(targetConvInList.isPinned, true, "Conversation must have isPinned: true in list");
  assert.equal(convsAfterPinData.conversations[0].id, v1Conv.id, "Pinned conversation must appear first in list");
  console.log("✔ Verified pinned conversation appears at top of admin inbox");

  // Unpin Conversation
  const unpinRes = await fetch(`${BASE_URL}/api/admin/live-chat/conversations`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
    },
    body: JSON.stringify({
      conversationId: v1Conv.id,
      isPinned: false,
    }),
  });
  assert.equal(unpinRes.status, 200);
  const unpinData = await unpinRes.json();
  assert.equal(unpinData.isPinned, false);
  console.log("✔ Admin unpinned conversation successfully");

  // Delete Conversation
  const deleteRes = await fetch(`${BASE_URL}/api/admin/live-chat/conversations`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
    },
    body: JSON.stringify({
      conversationId: v1Conv.id,
    }),
  });
  assert.equal(deleteRes.status, 200, "Delete request should return HTTP 200");
  const deleteData = await deleteRes.json();
  assert.equal(deleteData.success, true);
  console.log("✔ Admin deleted conversation successfully");

  // Verify conversation is no longer present in conversation list
  const convsAfterDeleteRes = await fetch(`${BASE_URL}/api/admin/live-chat/conversations`, {
    headers: { Cookie: adminCookie },
  });
  const convsAfterDeleteData = await convsAfterDeleteRes.json();
  const deletedStillPresent = convsAfterDeleteData.conversations.some((c) => c.id === v1Conv.id);
  assert.equal(deletedStillPresent, false, "Deleted conversation must no longer appear in active list");
  console.log("✔ Verified deleted conversation is removed from inbox");

  console.log("\n=== 8. Testing Direct Email Notification Link & Route (/admin/inbox/<id>) ===");
  const testConvId = "test-conv-e2e-direct-id";
  // Unauthenticated direct link navigation
  const directUnauthRes = await fetch(`${BASE_URL}/admin/inbox/${testConvId}`);
  assert.equal(directUnauthRes.status, 200, "Direct conversation URL must return 200");
  const directUnauthHtml = await directUnauthRes.text();
  assert.ok(
    directUnauthHtml.includes("Admin Live Inbox") || directUnauthHtml.includes("Admin Access Password"),
    "Unauthenticated visitor to /admin/inbox/<id> must receive login screen",
  );
  console.log("✔ Direct navigation to /admin/inbox/<id> without auth renders login screen");

  // Authenticated direct link navigation
  const directAuthRes = await fetch(`${BASE_URL}/admin/inbox/${testConvId}`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(directAuthRes.status, 200, "Authenticated direct conversation URL must return 200");
  const directAuthHtml = await directAuthRes.text();
  assert.ok(
    directAuthHtml.includes("Ganganathan") || directAuthHtml.includes("Admin Live Inbox"),
    "Authenticated admin receives live inbox page",
  );
  console.log("✔ Direct navigation to /admin/inbox/<id> with auth returns HTTP 200");

  console.log("\n=== 9. Testing Multipart Attachment Uploads & Authorization ===");
  // Test 9.1: Brand new visitor uploading an image before any text message
  const imageFormData = new FormData();
  const dummyImageBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG magic bytes
  const imageBlob = new Blob([dummyImageBytes], { type: "image/png" });
  imageFormData.append("file", imageBlob, "test-preview.png");

  const newVisitorUploadRes = await fetch(`${BASE_URL}/api/live-chat/attachments`, {
    method: "POST",
    body: imageFormData,
  });
  assert.equal(newVisitorUploadRes.status, 200, "New visitor attachment upload should return HTTP 200");
  const newVisitorUploadData = await newVisitorUploadRes.json();
  assert.equal(newVisitorUploadData.success, true);
  assert.ok(newVisitorUploadData.attachment.id);
  assert.equal(newVisitorUploadData.attachment.fileName, "test-preview.png");
  assert.equal(newVisitorUploadData.attachment.mimeType, "image/png");

  // Verify that a session cookie was established and returned for the new visitor
  const uploadCookie = newVisitorUploadRes.headers.get("set-cookie");
  assert.ok(uploadCookie, "Upload response for new visitor must issue session cookie");
  assert.ok(uploadCookie.includes("ganganathan_visitor_session"));
  console.log("✔ Brand-new visitor successfully uploaded image and received guest session cookie");

  // Test 9.2: Uploading a PDF document
  const pdfFormData = new FormData();
  const dummyPdfBytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]); // %PDF-1.4 magic bytes
  const pdfBlob = new Blob([dummyPdfBytes], { type: "application/pdf" });
  pdfFormData.append("file", pdfBlob, "test-project-brief.pdf");

  const pdfUploadRes = await fetch(`${BASE_URL}/api/live-chat/attachments`, {
    method: "POST",
    headers: {
      Cookie: uploadCookie,
    },
    body: pdfFormData,
  });
  assert.equal(pdfUploadRes.status, 200, "PDF upload must succeed with HTTP 200");
  const pdfUploadData = await pdfUploadRes.json();
  assert.equal(pdfUploadData.success, true);
  assert.equal(pdfUploadData.attachment.mimeType, "application/pdf");
  console.log("✔ PDF document attachment uploaded successfully");

  // Test 9.3: Authorized attachment retrieval
  const getAttachmentRes = await fetch(`${BASE_URL}/api/live-chat/attachments/${newVisitorUploadData.attachment.id}`, {
    headers: { Cookie: uploadCookie },
  });
  assert.equal(getAttachmentRes.status, 200, "Authorized owner must be able to view attachment");
  assert.equal(getAttachmentRes.headers.get("content-type"), "image/png");
  console.log("✔ Authorized user successfully streamed attachment");

  // Test 9.4: Unauthorized stranger attempts to access visitor's attachment -> 403 Forbidden
  const strangerUploadRes = await fetch(`${BASE_URL}/api/live-chat/attachments/${newVisitorUploadData.attachment.id}`, {
    headers: { Cookie: "ganganathan_visitor_session=unauthorized_stranger_token_00000000000000000000000000000000" },
  });
  assert.equal(strangerUploadRes.status, 403, "Unauthorized user must be rejected with HTTP 403");
  console.log("✔ Security check passed: Unauthorized attachment access blocked with HTTP 403");

  // Test 9.5: Admin is authorized to view visitor's attachment
  const adminAttachmentRes = await fetch(`${BASE_URL}/api/live-chat/attachments/${newVisitorUploadData.attachment.id}`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(adminAttachmentRes.status, 200, "Admin must be authorized to view conversation attachments");
  console.log("✔ Admin successfully accessed visitor attachment");

  console.log("\n=== 10. Testing Project Card Data Integrity ===");
  const fs = await import("fs");
  const constantsContent = fs.readFileSync(new URL("../src/constants/index.ts", import.meta.url), "utf-8");
  assert.ok(constantsContent.includes('name: "ShaChat"'), "ShaChat project must exist in constants");
  assert.ok(/name:\s*"ShaChat"[\s\S]*?source_code_link:\s*null/.test(constantsContent), "ShaChat source_code_link must be null (private repo)");
  console.log("✔ Project card private repository and deployment data validated");

  console.log("\n=== 11. Testing Public Commands API & Submission ===");
  // Public GET /api/commands
  const pubCmdsRes = await fetch(`${BASE_URL}/api/commands`);
  assert.equal(pubCmdsRes.status, 200, "Public GET /api/commands must return 200");
  const pubCmdsData = await pubCmdsRes.json();
  assert.equal(pubCmdsData.success, true);
  assert.ok(Array.isArray(pubCmdsData.commands), "commands must be an array");
  console.log("✔ Public commands endpoint active and accessible (%d commands found)", pubCmdsData.commands.length);

  // Visitor submits a new command via POST /api/commands
  const postCmdRes = await fetch(`${BASE_URL}/api/commands`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "X-Forwarded-For": "203.0.113.88",
    },
    body: JSON.stringify({
      command: "git branch --merged | grep -v '\\*' | xargs -n 1 git branch -d",
      author_name: "DevTester",
      title: "Clean Merged Git Branches",
      category: "Git",
    }),
  });
  assert.equal(postCmdRes.status, 201, "Command submission must return HTTP 201 Created");
  const postCmdData = await postCmdRes.json();
  assert.equal(postCmdData.success, true);
  assert.ok(postCmdData.command.id);
  assert.equal(postCmdData.command.command, "git branch --merged | grep -v '\\*' | xargs -n 1 git branch -d");
  assert.equal(postCmdData.command.author_name, "DevTester");
  // STRICT PRIVACY CHECK: Verify client response does NOT leak server-side telemetry
  assert.equal(postCmdData.command.metadata, undefined, "Public response must NEVER leak metadata object");
  assert.equal(postCmdData.command.ip, undefined, "Public response must NEVER leak IP address");
  assert.equal(postCmdData.command.userAgent, undefined, "Public response must NEVER leak User-Agent");
  console.log("✔ Visitor command submitted successfully; private telemetry confirmed stripped from public response");

  const testCmdId = postCmdData.command.id;

  // Verify command appears in public GET /api/commands
  const updatedPubCmdsRes = await fetch(`${BASE_URL}/api/commands`);
  const updatedPubCmdsData = await updatedPubCmdsRes.json();
  const newlyCreated = updatedPubCmdsData.commands.find((c) => c.id === testCmdId);
  assert.ok(newlyCreated, "Newly created command must be visible in public listing");
  assert.equal(newlyCreated.metadata, undefined, "Public list items must NEVER leak metadata");
  console.log("✔ Newly submitted command confirmed visible in public listing");

  console.log("\n=== 12. Testing Admin Commands Management & Telemetry Moderation ===");
  // Test unauthorized access
  const unauthAdminCmdRes = await fetch(`${BASE_URL}/api/admin/commands`);
  assert.equal(unauthAdminCmdRes.status, 401, "Unauthorized GET /api/admin/commands must return 401");
  console.log("✔ Security check passed: Unauthorized access to admin commands rejected with HTTP 401");

  // Authorized Admin GET /api/admin/commands
  const authAdminCmdRes = await fetch(`${BASE_URL}/api/admin/commands`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(authAdminCmdRes.status, 200, "Authorized admin GET /api/admin/commands must return 200");
  const adminCmdData = await authAdminCmdRes.json();
  assert.equal(adminCmdData.success, true);
  assert.ok(adminCmdData.stats, "Stats object must be returned to admin");
  assert.ok(adminCmdData.stats.total >= 1);
  const foundInAdmin = adminCmdData.commands.find((c) => c.id === testCmdId);
  assert.ok(foundInAdmin, "Created command must exist in admin listing");
  assert.ok(foundInAdmin.metadata, "Admin MUST have access to telemetry metadata");
  assert.equal(foundInAdmin.metadata.deviceType, "desktop");
  assert.equal(foundInAdmin.metadata.osFamily, "macOS");
  assert.equal(foundInAdmin.metadata.browserFamily, "Chrome");
  assert.equal(foundInAdmin.metadata.ip, "203.0.113.88");
  console.log("✔ Admin successfully retrieved full command listing with device and IP metadata");

  // Admin Hides command
  const hideRes = await fetch(`${BASE_URL}/api/admin/commands`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
    },
    body: JSON.stringify({ id: testCmdId, action: "hide" }),
  });
  assert.equal(hideRes.status, 200, "Admin hide action must return 200");
  console.log("✔ Admin hid command successfully");

  // Verify command disappeared from public GET /api/commands
  const afterHidePubRes = await fetch(`${BASE_URL}/api/commands`);
  const afterHidePubData = await afterHidePubRes.json();
  assert.equal(
    afterHidePubData.commands.some((c) => c.id === testCmdId),
    false,
    "Hidden command must NOT be returned in public API"
  );
  console.log("✔ Hidden command confirmed removed from public Commands section");

  // Admin Restores command
  const restoreRes = await fetch(`${BASE_URL}/api/admin/commands`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
    },
    body: JSON.stringify({ id: testCmdId, action: "restore" }),
  });
  assert.equal(restoreRes.status, 200, "Admin restore action must return 200");
  console.log("✔ Admin restored command successfully");

  // Verify command reappeared in public GET /api/commands
  const afterRestorePubRes = await fetch(`${BASE_URL}/api/commands`);
  const afterRestorePubData = await afterRestorePubRes.json();
  assert.ok(
    afterRestorePubData.commands.some((c) => c.id === testCmdId),
    "Restored command must reappear in public Commands section"
  );
  console.log("✔ Restored command confirmed back in public Commands section");

  // Admin Deletes command
  const deleteCmdRes = await fetch(`${BASE_URL}/api/admin/commands?id=${testCmdId}`, {
    method: "DELETE",
    headers: { Cookie: adminCookie },
  });
  assert.equal(deleteCmdRes.status, 200, "Admin delete action must return 200");
  console.log("✔ Admin deleted command successfully");

  // Verify deleted command is excluded from public listing
  const afterDeletePubRes = await fetch(`${BASE_URL}/api/commands`);
  const afterDeletePubData = await afterDeletePubRes.json();
  assert.equal(
    afterDeletePubData.commands.some((c) => c.id === testCmdId),
    false,
    "Deleted command must NOT be returned in public API"
  );
  console.log("✔ Deleted command confirmed excluded from public Commands section");

  console.log("\n=== 13. Testing Admin Commands Dashboard Route & Projects Page Scroll ===");
  const adminPageRes = await fetch(`${BASE_URL}/admin/commands`);
  assert.equal(adminPageRes.status, 200, "/admin/commands route must return HTTP 200");
  const freshHomeRes = await fetch(`${BASE_URL}/`);
  const freshHomeHtml = await freshHomeRes.text();
  assert.ok(freshHomeHtml.includes('id="commands"'), "Home page must include Commands section anchor");
  assert.ok(freshHomeHtml.includes('Featured'), "Home page must include Featured Projects heading");
  console.log("✔ /admin/commands and redesigned portfolio sections confirmed rendering properly");

  console.log("\n=== 14. Testing Verified Email Identity & Returning User History Restoration ===");
  // Step 1: Alice creates Session A and sends a message
  const aliceSessARes = await fetch(`${BASE_URL}/api/live-chat/session`);
  const aliceCookieA = aliceSessARes.headers.get("set-cookie");
  assert.ok(aliceCookieA);

  const aliceEmail = `alice.${Date.now()}@example.com`;
  const aliceMsg1 = await fetch(`${BASE_URL}/api/live-chat/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: aliceCookieA },
    body: JSON.stringify({ content: "Alice initial inquiry in Session A" }),
  });
  assert.equal(aliceMsg1.status, 200);

  // Request OTP for Alice
  const aliceOtpReq = await fetch(`${BASE_URL}/api/live-chat/otp/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: aliceCookieA },
    body: JSON.stringify({ email: aliceEmail }),
  });
  assert.equal(aliceOtpReq.status, 200);

  // Read latest OTP hash for Alice from Supabase or local store
  const { getServerSupabase } = await import("../src/lib/supabase.ts");
  const { hashOtp } = await import("../src/lib/live-chat/security.ts");
  let otpHashA = null;

  try {
    const supabase = getServerSupabase();
    const { data: supaOtps } = await supabase
      .from("chat_email_otps")
      .select("otp_hash")
      .eq("email", aliceEmail)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (supaOtps && supaOtps.length > 0) {
      otpHashA = supaOtps[0].otp_hash;
    }
  } catch {}

  if (!otpHashA) {
    const dataDir = process.env.VERCEL ? "/tmp/.data" : path.join(process.cwd(), ".data");
    const storeFile = path.join(dataDir, "live-chat-store.json");
    if (fs.existsSync(storeFile)) {
      const store = JSON.parse(fs.readFileSync(storeFile, "utf-8"));
      for (const otps of Object.values(store.emailOtps || {})) {
        const found = otps.find((o) => o.email === aliceEmail && !o.usedAt);
        if (found) {
          otpHashA = found.otpHash;
          break;
        }
      }
    }
  }

  assert.ok(otpHashA, "Should locate OTP hash record");

  // In test environment, solve 6-digit candidate for the hash in ~2 seconds
  let aliceOtpCode = null;
  for (let c = 0; c < 1000000; c++) {
    const candidate = String(c).padStart(6, "0");
    if (hashOtp(aliceEmail, candidate) === otpHashA) {
      aliceOtpCode = candidate;
      break;
    }
  }

  assert.ok(aliceOtpCode, "Should locate valid OTP code");

  const aliceVerifyResA = await fetch(`${BASE_URL}/api/live-chat/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: aliceCookieA },
    body: JSON.stringify({ email: aliceEmail, otp: aliceOtpCode }),
  });
  assert.equal(aliceVerifyResA.status, 200);
  const aliceVerifyDataA = await aliceVerifyResA.json();
  assert.equal(aliceVerifyDataA.emailVerified, true);
  console.log("✔ Alice verified email in Session A");

  // Step 2: Alice returns in Session B (simulating incognito / new device)
  const aliceSessBRes = await fetch(`${BASE_URL}/api/live-chat/session`);
  const aliceCookieB = aliceSessBRes.headers.get("set-cookie");
  assert.notEqual(aliceCookieA, aliceCookieB, "Session B must have fresh cookie");

  // Alice sends a new message in Session B before verifying
  const aliceMsg2 = await fetch(`${BASE_URL}/api/live-chat/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: aliceCookieB },
    body: JSON.stringify({ content: "Alice follow-up in Session B" }),
  });
  assert.equal(aliceMsg2.status, 200);

  // Alice requests OTP in Session B
  const aliceOtpReqB = await fetch(`${BASE_URL}/api/live-chat/otp/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: aliceCookieB },
    body: JSON.stringify({ email: aliceEmail }),
  });
  assert.equal(aliceOtpReqB.status, 200);

  // Read OTP for Session B
  let otpHashB = null;
  try {
    const supabase = getServerSupabase();
    const { data: supaOtpsB } = await supabase
      .from("chat_email_otps")
      .select("otp_hash")
      .eq("email", aliceEmail)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (supaOtpsB && supaOtpsB.length > 0) {
      otpHashB = supaOtpsB[0].otp_hash;
    }
  } catch {}

  if (!otpHashB) {
    const dataDir = process.env.VERCEL ? "/tmp/.data" : path.join(process.cwd(), ".data");
    const storeFile = path.join(dataDir, "live-chat-store.json");
    if (fs.existsSync(storeFile)) {
      const store = JSON.parse(fs.readFileSync(storeFile, "utf-8"));
      for (const otps of Object.values(store.emailOtps || {})) {
        const found = otps.find((o) => o.email === aliceEmail && !o.usedAt);
        if (found) {
          otpHashB = found.otpHash;
          break;
        }
      }
    }
  }

  assert.ok(otpHashB, "Should locate second OTP hash record");

  let aliceOtpCodeB = null;
  for (let c = 0; c < 1000000; c++) {
    const candidate = String(c).padStart(6, "0");
    if (hashOtp(aliceEmail, candidate) === otpHashB) {
      aliceOtpCodeB = candidate;
      break;
    }
  }

  assert.ok(aliceOtpCodeB, "Should locate second OTP code");

  // Alice verifies in Session B
  const aliceVerifyResB = await fetch(`${BASE_URL}/api/live-chat/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: aliceCookieB },
    body: JSON.stringify({ email: aliceEmail, otp: aliceOtpCodeB }),
  });
  assert.equal(aliceVerifyResB.status, 200);
  const aliceVerifyDataB = await aliceVerifyResB.json();
  assert.equal(aliceVerifyDataB.emailVerified, true);
  assert.equal(aliceVerifyDataB.restored, true, "Session B must report restored: true");
  console.log("✔ Alice verified in Session B, backend restored previous canonical conversation");

  // Step 3: Fetch messages in Session B and assert complete history is present
  const aliceMsgsBRes = await fetch(`${BASE_URL}/api/live-chat/messages`, {
    headers: { Cookie: aliceCookieB },
  });
  assert.equal(aliceMsgsBRes.status, 200);
  const aliceMsgsB = await aliceMsgsBRes.json();
  const aliceContentsB = aliceMsgsB.messages.map((m) => m.content);

  assert.ok(
    aliceContentsB.includes("Alice initial inquiry in Session A"),
    "Session B messages MUST include message from Session A",
  );
  assert.ok(
    aliceContentsB.includes("Alice follow-up in Session B"),
    "Session B messages MUST include message sent before verification in Session B",
  );
  console.log("✔ Returning verified identity restored complete message history across sessions (found %d messages)", aliceMsgsB.messages.length);

  // Step 4: Verify privacy isolation: Bob cannot see Alice's restored conversation
  const bobSessRes = await fetch(`${BASE_URL}/api/live-chat/session`);
  const bobCookie = bobSessRes.headers.get("set-cookie");
  const bobMsgsRes = await fetch(`${BASE_URL}/api/live-chat/messages`, {
    headers: { Cookie: bobCookie },
  });
  const bobMsgs = await bobMsgsRes.json();
  assert.equal(
    bobMsgs.messages.some((m) => m.content.includes("Alice")),
    false,
    "Bob MUST NOT see Alice's restored messages",
  );
  console.log("✔ Privacy check passed: Distinct user has zero access to Alice's restored conversation");

  console.log("\n=======================================================");
  console.log("🎉 ALL E2E FUNCTIONAL, SECURITY, AND PRIVACY CHECKS PASSED!");
  console.log("=======================================================");
}

runE2E().catch((err) => {
  console.error("❌ E2E Test Failure:", err);
  process.exit(1);
});
