import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

import {
  generateSecureToken,
  hashToken,
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
} from "../src/lib/live-chat/security.ts";
import { registerAdminActiveSession } from "../src/lib/live-chat/session-registry.ts";
import {
  getOrCreateConversationByHash,
  addMessage,
  getAllConversationsForAdmin,
  deleteConversationsBulkByAdmin,
} from "../src/lib/live-chat/db.ts";
import { DELETE as adminConversationsDelete } from "../src/app/api/admin/live-chat/conversations/route.ts";

test("Admin Inbox Bulk Delete & Multi-Select Test Suite", async (t) => {
  // Setup 3 test conversations
  const token1 = generateSecureToken();
  const conv1 = await getOrCreateConversationByHash(hashToken(token1));
  await addMessage({
    conversationId: conv1.id,
    senderType: "visitor",
    content: "Message in conv 1",
  });

  const token2 = generateSecureToken();
  const conv2 = await getOrCreateConversationByHash(hashToken(token2));
  await addMessage({
    conversationId: conv2.id,
    senderType: "visitor",
    content: "Message in conv 2",
  });

  const token3 = generateSecureToken();
  const conv3 = await getOrCreateConversationByHash(hashToken(token3));
  await addMessage({
    conversationId: conv3.id,
    senderType: "visitor",
    content: "Message in conv 3",
  });

  // Verify they exist in admin conversation list
  let list = await getAllConversationsForAdmin({ status: "all" });
  assert.ok(list.some((c) => c.id === conv1.id));
  assert.ok(list.some((c) => c.id === conv2.id));
  assert.ok(list.some((c) => c.id === conv3.id));

  // 1. Direct DB Bulk Delete
  await t.test("1. deleteConversationsBulkByAdmin deletes multiple conversations and returns deleted/failed arrays", async () => {
    const res = await deleteConversationsBulkByAdmin([conv1.id, conv2.id]);
    assert.deepEqual(res.deleted.sort(), [conv1.id, conv2.id].sort());
    assert.deepEqual(res.failed, []);

    // Verify conv1 and conv2 are deleted from list, but conv3 remains
    const updatedList = await getAllConversationsForAdmin({ status: "all" });
    assert.equal(updatedList.some((c) => c.id === conv1.id), false);
    assert.equal(updatedList.some((c) => c.id === conv2.id), false);
    assert.equal(updatedList.some((c) => c.id === conv3.id), true);
  });

  // 2. Partial Failure Handling
  await t.test("2. deleteConversationsBulkByAdmin handles non-existent IDs cleanly", async () => {
    const nonExistentId = "non-existent-conv-id-999";
    const res = await deleteConversationsBulkByAdmin([conv3.id, nonExistentId]);
    assert.deepEqual(res.deleted, [conv3.id]);
    assert.deepEqual(res.failed, [nonExistentId]);

    const updatedList = await getAllConversationsForAdmin({ status: "all" });
    assert.equal(updatedList.some((c) => c.id === conv3.id), false);
  });

  // 3. API Authentication & Authorization
  await t.test("3. DELETE /api/admin/live-chat/conversations rejects unauthorized requests", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/live-chat/conversations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationIds: ["dummy-id"] }),
    });

    const res = await adminConversationsDelete(req);
    assert.equal(res.status, 401);
  });

  // 4. API Input Validation
  await t.test("4. DELETE /api/admin/live-chat/conversations rejects invalid or empty payloads", async () => {
    // Generate valid admin session
    const { token: adminToken } = await registerAdminActiveSession();

    // Empty array
    const reqEmpty = new NextRequest("http://localhost:3000/api/admin/live-chat/conversations", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        cookie: `${ADMIN_COOKIE_NAME}=${adminToken}`,
      },
      body: JSON.stringify({ conversationIds: [] }),
    });
    const resEmpty = await adminConversationsDelete(reqEmpty);
    assert.equal(resEmpty.status, 400);

    // Missing conversationId or conversationIds
    const reqMissing = new NextRequest("http://localhost:3000/api/admin/live-chat/conversations", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        cookie: `${ADMIN_COOKIE_NAME}=${adminToken}`,
      },
      body: JSON.stringify({}),
    });
    const resMissing = await adminConversationsDelete(reqMissing);
    assert.equal(resMissing.status, 400);
  });

  // 5. API Bulk Deletion Execution with Success
  await t.test("5. DELETE /api/admin/live-chat/conversations bulk deletes conversations for authorized admin", async () => {
    // Create two new conversations to delete via API
    const c4 = await getOrCreateConversationByHash(hashToken(generateSecureToken()));
    const c5 = await getOrCreateConversationByHash(hashToken(generateSecureToken()));

    const { token: adminToken } = await registerAdminActiveSession();

    const req = new NextRequest("http://localhost:3000/api/admin/live-chat/conversations", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        cookie: `${ADMIN_COOKIE_NAME}=${adminToken}`,
      },
      body: JSON.stringify({ conversationIds: [c4.id, c5.id] }),
    });

    const res = await adminConversationsDelete(req);
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.deletedCount, 2);
    assert.deepEqual(data.deletedIds.sort(), [c4.id, c5.id].sort());
    assert.deepEqual(data.failedIds, []);

    // Confirm deleted from admin list
    const finalList = await getAllConversationsForAdmin({ status: "all" });
    assert.equal(finalList.some((c) => c.id === c4.id), false);
    assert.equal(finalList.some((c) => c.id === c5.id), false);
  });

  // 6. API Single Deletion Backward Compatibility
  await t.test("6. DELETE /api/admin/live-chat/conversations supports single conversationId for backward compatibility", async () => {
    const c6 = await getOrCreateConversationByHash(hashToken(generateSecureToken()));

    const { token: adminToken } = await registerAdminActiveSession();

    const req = new NextRequest("http://localhost:3000/api/admin/live-chat/conversations", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        cookie: `${ADMIN_COOKIE_NAME}=${adminToken}`,
      },
      body: JSON.stringify({ conversationId: c6.id }),
    });

    const res = await adminConversationsDelete(req);
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.conversationId, c6.id);

    const finalList = await getAllConversationsForAdmin({ status: "all" });
    assert.equal(finalList.some((c) => c.id === c6.id), false);
  });
});
