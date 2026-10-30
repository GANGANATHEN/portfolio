import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST as uploadAttachmentPost } from "../src/app/api/live-chat/attachments/route.ts";
import { GET as streamAttachmentGet } from "../src/app/api/live-chat/attachments/[id]/route.ts";
import {
  generateSecureToken,
  hashToken,
  createAdminSessionToken,
  VISITOR_COOKIE_NAME,
  ADMIN_COOKIE_NAME,
} from "../src/lib/live-chat/security.ts";
import { registerAdminActiveSession } from "../src/lib/live-chat/session-registry.ts";
import {
  getOrCreateConversationByHash,
  getAttachmentById,
} from "../src/lib/live-chat/db.ts";

test("Attachment Upload & Secure Streaming Test Suite", async (t) => {
  const dummyPngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  const dummyFileBlob = new Blob([dummyPngBytes], { type: "image/png" });

  await t.test("1. Fresh visitor without cookies can upload file (auto-creates conversation and sets cookie)", async () => {
    const formData = new FormData();
    formData.append("file", dummyFileBlob, "first-screenshot.png");

    const req = new NextRequest("http://localhost:3000/api/live-chat/attachments", {
      method: "POST",
      body: formData,
    });

    const res = await uploadAttachmentPost(req);
    assert.equal(res.status, 200, "Fresh visitor upload should return 200");
    const json = await res.json();
    assert.ok(json.success);
    assert.ok(json.attachment?.id);
    assert.ok(json.attachment?.conversationId);
    assert.equal(json.attachment.fileName, "first-screenshot.png");
    assert.equal(json.attachment.mimeType, "image/png");

    // Cookie set check
    const setCookie = res.headers.get("set-cookie");
    assert.ok(setCookie && setCookie.includes(VISITOR_COOKIE_NAME), "Must set visitor cookie");
  });

  await t.test("2. Existing visitor with token uploads file to own conversation", async () => {
    const visitorToken = generateSecureToken();
    const tokenHash = hashToken(visitorToken);
    const conv = await getOrCreateConversationByHash(tokenHash, "Existing Visitor");

    const formData = new FormData();
    formData.append("file", dummyFileBlob, "report.png");
    formData.append("conversationId", conv.id);

    const req = new NextRequest("http://localhost:3000/api/live-chat/attachments", {
      method: "POST",
      headers: {
        cookie: `${VISITOR_COOKIE_NAME}=${visitorToken}`,
      },
      body: formData,
    });

    const res = await uploadAttachmentPost(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(json.success);
    assert.equal(json.attachment.conversationId, conv.id);
  });

  await t.test("3. Visitor attempting to upload to another conversation is rejected with 403", async () => {
    const visitorAToken = generateSecureToken();
    const hashA = hashToken(visitorAToken);
    await getOrCreateConversationByHash(hashA, "Visitor A");

    const visitorBToken = generateSecureToken();
    const hashB = hashToken(visitorBToken);
    const convB = await getOrCreateConversationByHash(hashB, "Visitor B");

    const formData = new FormData();
    formData.append("file", dummyFileBlob, "hack.png");
    formData.append("conversationId", convB.id); // Visitor A targeting Visitor B's conv

    const req = new NextRequest("http://localhost:3000/api/live-chat/attachments", {
      method: "POST",
      headers: {
        cookie: `${VISITOR_COOKIE_NAME}=${visitorAToken}`,
      },
      body: formData,
    });

    const res = await uploadAttachmentPost(req);
    assert.equal(res.status, 403, "Targeting unauthorized conversation must return 403");
  });

  await t.test("4. Unsupported file MIME type is rejected with 415", async () => {
    const exeBlob = new Blob([new Uint8Array([77, 90, 144, 0])], { type: "application/x-msdownload" });
    const formData = new FormData();
    formData.append("file", exeBlob, "malicious.exe");

    const req = new NextRequest("http://localhost:3000/api/live-chat/attachments", {
      method: "POST",
      body: formData,
    });

    const res = await uploadAttachmentPost(req);
    assert.equal(res.status, 415, "Executable/unsupported type must be rejected with 415");
  });

  await t.test("5. Admin can upload attachments to any conversation", async () => {
    const visitorToken = generateSecureToken();
    const tokenHash = hashToken(visitorToken);
    const conv = await getOrCreateConversationByHash(tokenHash, "Visitor For Admin Upload");

    const { token: adminToken } = await registerAdminActiveSession();
    const formData = new FormData();
    formData.append("file", dummyFileBlob, "admin-schematic.png");
    formData.append("conversationId", conv.id);

    const req = new NextRequest("http://localhost:3000/api/live-chat/attachments", {
      method: "POST",
      headers: {
        cookie: `${ADMIN_COOKIE_NAME}=${adminToken}`,
      },
      body: formData,
    });

    const res = await uploadAttachmentPost(req);
    assert.equal(res.status, 200, "Admin upload should succeed");
    const json = await res.json();
    assert.ok(json.success);
    assert.equal(json.attachment.conversationId, conv.id);
  });

  await t.test("6. Streaming attachment: authorized visitor can view attachment", async () => {
    const visitorToken = generateSecureToken();
    const tokenHash = hashToken(visitorToken);
    const conv = await getOrCreateConversationByHash(tokenHash, "Visitor Streaming");

    // Upload attachment
    const formData = new FormData();
    formData.append("file", dummyFileBlob, "stream-test.png");
    formData.append("conversationId", conv.id);

    const uploadReq = new NextRequest("http://localhost:3000/api/live-chat/attachments", {
      method: "POST",
      headers: { cookie: `${VISITOR_COOKIE_NAME}=${visitorToken}` },
      body: formData,
    });
    const uploadRes = await uploadAttachmentPost(uploadReq);
    const uploadJson = await uploadRes.json();
    const attachmentId = uploadJson.attachment.id;

    // View inline
    const streamReq = new NextRequest(`http://localhost:3000/api/live-chat/attachments/${attachmentId}`, {
      method: "GET",
      headers: { cookie: `${VISITOR_COOKIE_NAME}=${visitorToken}` },
    });
    const streamRes = await streamAttachmentGet(streamReq, { params: Promise.resolve({ id: attachmentId }) });
    assert.equal(streamRes.status, 200);
    assert.equal(streamRes.headers.get("content-type"), "image/png");
    assert.ok(streamRes.headers.get("content-disposition")?.includes("inline"));

    // View download
    const downloadReq = new NextRequest(`http://localhost:3000/api/live-chat/attachments/${attachmentId}?download=true`, {
      method: "GET",
      headers: { cookie: `${VISITOR_COOKIE_NAME}=${visitorToken}` },
    });
    const downloadRes = await streamAttachmentGet(downloadReq, { params: Promise.resolve({ id: attachmentId }) });
    assert.equal(downloadRes.status, 200);
    assert.ok(downloadRes.headers.get("content-disposition")?.includes("attachment"));
  });

  await t.test("7. Stranger visitor cannot access another visitor's attachment (403)", async () => {
    const visitorAToken = generateSecureToken();
    const hashA = hashToken(visitorAToken);
    const convA = await getOrCreateConversationByHash(hashA, "Visitor A Private");

    const formData = new FormData();
    formData.append("file", dummyFileBlob, "secret-plans.png");
    formData.append("conversationId", convA.id);

    const uploadReq = new NextRequest("http://localhost:3000/api/live-chat/attachments", {
      method: "POST",
      headers: { cookie: `${VISITOR_COOKIE_NAME}=${visitorAToken}` },
      body: formData,
    });
    const uploadRes = await uploadAttachmentPost(uploadReq);
    const uploadJson = await uploadRes.json();
    const attachmentId = uploadJson.attachment.id;

    // Stranger visitor B tries to access attachmentId
    const visitorBToken = generateSecureToken();
    const hashB = hashToken(visitorBToken);
    await getOrCreateConversationByHash(hashB, "Visitor B Stranger");

    const streamReq = new NextRequest(`http://localhost:3000/api/live-chat/attachments/${attachmentId}`, {
      method: "GET",
      headers: { cookie: `${VISITOR_COOKIE_NAME}=${visitorBToken}` },
    });
    const streamRes = await streamAttachmentGet(streamReq, { params: Promise.resolve({ id: attachmentId }) });
    assert.equal(streamRes.status, 403, "Stranger must be forbidden from downloading private attachment");
  });
});
