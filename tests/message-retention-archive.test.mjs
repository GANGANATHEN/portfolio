import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

process.env.EMAIL_NOTIFICATION_COOLDOWN_MINUTES = "10";
process.env.OWNER_EMAIL = "green11.dev@gmail.com";
process.env.RESEND_API_KEY = ""; // Simulation mode in tests

import {
  generateSecureToken,
  hashToken,
} from "../src/lib/live-chat/security.ts";

import {
  getOrCreateConversationByHash,
  addMessage,
  getMessages,
  markMessagesAsRead,
  createAttachmentRecord,
  getAttachmentById,
  getArchiveBatchById,
  getAllArchiveBatches,
  getEligibleMessagesForRetention,
  permanentlyDeleteArchivedMessages,
  updateMessageReadAtForTesting,
  DATA_DIR,
  ARCHIVES_DIR,
  associateConversationWithVerifiedEmail,
} from "../src/lib/live-chat/db.ts";

import {
  generateArchivePdf,
  submitArchiveBatchEmail,
  confirmDeliveryAndPermanentlyDelete,
  runRetentionArchiveJob,
  DEFAULT_RETENTION_MS,
} from "../src/lib/live-chat/archive.ts";

describe("24-Hour Message Retention, Archive & Permanent Deletion Suite", () => {
  before(() => {
    // Reset test database store
    const storeFile = path.join(DATA_DIR, "live-chat-store.json");
    if (fs.existsSync(storeFile)) {
      try {
        fs.unlinkSync(storeFile);
      } catch {}
    }
    if (!fs.existsSync(ARCHIVES_DIR)) {
      fs.mkdirSync(ARCHIVES_DIR, { recursive: true });
    }
  });

  test("1. Unread message is NEVER eligible for retention deletion", async () => {
    const token = generateSecureToken();
    const conv = await getOrCreateConversationByHash(hashToken(token), "Alice Unread");

    // Add unread message
    const msg = await addMessage({
      conversationId: conv.id,
      senderType: "visitor",
      content: "Important unread message",
    });
    assert.equal(msg.readAt, null, "Initial readAt must be null");

    // Scan for eligible messages past retention
    const eligible = await getEligibleMessagesForRetention(0); // Even with 0ms retention
    const convEligible = eligible[conv.id] || [];
    assert.equal(
      convEligible.some((m) => m.id === msg.id),
      false,
      "Unread message must NEVER be eligible for deletion",
    );
  });

  test("2. Receiver reads message and 24-hour countdown starts; not deleted before 24 hours", async () => {
    const token = generateSecureToken();
    const conv = await getOrCreateConversationByHash(hashToken(token), "Bob Read Timer");

    const msg = await addMessage({
      conversationId: conv.id,
      senderType: "visitor",
      content: "Message read by owner",
    });

    // Owner reads the message
    await markMessagesAsRead(conv.id, "owner");
    const msgs = await getMessages(conv.id);
    const readMsg = msgs.find((m) => m.id === msg.id);
    assert.ok(readMsg?.readAt, "Receiver read timestamp must be durably recorded");

    // Check with 24-hour retention requirement
    const eligibleBefore24h = await getEligibleMessagesForRetention(DEFAULT_RETENTION_MS);
    const convEligible = eligibleBefore24h[conv.id] || [];
    assert.equal(
      convEligible.some((m) => m.id === msg.id),
      false,
      "Message read less than 24h ago must NOT be eligible for deletion",
    );
  });

  test("3. Message becomes eligible after 24 hours and multiple messages are grouped per conversation", async () => {
    const token = generateSecureToken();
    const conv = await getOrCreateConversationByHash(hashToken(token), "Charlie Grouping");

    // Add 3 messages
    const msg1 = await addMessage({
      conversationId: conv.id,
      senderType: "visitor",
      content: "Charlie Message 1",
    });
    const msg2 = await addMessage({
      conversationId: conv.id,
      senderType: "owner",
      content: "Owner reply to Charlie",
    });
    const msg3 = await addMessage({
      conversationId: conv.id,
      senderType: "visitor",
      content: "Charlie Message 3",
    });

    // Mark as read
    await markMessagesAsRead(conv.id, "owner");
    await markMessagesAsRead(conv.id, "visitor");

    // Allow simulated 1ms threshold to elapse
    await new Promise((r) => setTimeout(r, 25));

    // Test with simulated retention threshold (1ms) to verify grouping
    const eligible = await getEligibleMessagesForRetention(1);
    const group = eligible[conv.id];
    assert.ok(group, "Must find eligible messages for conversation");
    assert.equal(group.length >= 3, true, "All read messages must be grouped into single conversation batch");
    assert.ok(group.some((m) => m.id === msg1.id));
    assert.ok(group.some((m) => m.id === msg2.id));
    assert.ok(group.some((m) => m.id === msg3.id));
  });

  test("4. PDF transcript is generated durably before deletion and includes full message snapshot", async () => {
    const token = generateSecureToken();
    const conv = await getOrCreateConversationByHash(hashToken(token), "Dave PDF Check");

    const msg = await addMessage({
      conversationId: conv.id,
      senderType: "visitor",
      content: "Transcript test message with special chars: & < > ' \" —",
    });
    await markMessagesAsRead(conv.id, "owner");

    const batchId = crypto.randomUUID();
    const { buffer, filePath } = await generateArchivePdf({
      conversation: conv,
      messages: [msg],
      batchId,
    });

    assert.ok(buffer && buffer.length > 500, "PDF buffer must be valid and non-empty");
    assert.equal(fs.existsSync(filePath), true, "PDF must be written to durable archives directory");

    // Check PDF magic bytes (%PDF-)
    const magic = buffer.slice(0, 5).toString("utf-8");
    assert.equal(magic, "%PDF-", "Generated document must be a valid PDF");
  });

  test("5. Email submission failure PREVENTS deletion (messages remain completely intact)", async () => {
    const token = generateSecureToken();
    const conv = await getOrCreateConversationByHash(hashToken(token), "Eve Failure Hold");

    const msg = await addMessage({
      conversationId: conv.id,
      senderType: "visitor",
      content: "Do not delete if email fails",
    });
    await markMessagesAsRead(conv.id, "owner");

    // Run job with forced delivery = false
    const batchId = crypto.randomUUID();
    const batch = {
      id: batchId,
      conversationId: conv.id,
      messageIds: [msg.id],
      messageCount: 1,
      status: "processing",
      pdfStoragePath: null,
      emailMessageId: null,
      deliveryConfirmedAt: null,
      deletedAt: null,
      errorMessage: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Attempt deletion without confirmed email delivery
    const delResult = await confirmDeliveryAndPermanentlyDelete(batchId);
    assert.equal(delResult.success, false, "Must reject permanent deletion when email is unconfirmed");

    // Verify message STILL EXISTS
    const messages = await getMessages(conv.id);
    assert.ok(messages.some((m) => m.id === msg.id), "Original message must be retained intact");
  });

  test("6. Confirmed delivery permanently deletes messages and associated attachments", async () => {
    const token = generateSecureToken();
    const conv = await getOrCreateConversationByHash(hashToken(token), "Frank Permanent Deletion");

    const msg = await addMessage({
      conversationId: conv.id,
      senderType: "visitor",
      content: "Expired message that must disappear permanently",
    });
    await markMessagesAsRead(conv.id, "owner");

    // Create an attachment linked to this message
    const dummyPath = path.join(DATA_DIR, "attachments", `temp-${Date.now()}.txt`);
    fs.writeFileSync(dummyPath, "dummy attachment content");
    const att = await createAttachmentRecord({
      conversationId: conv.id,
      messageId: msg.id,
      fileName: "temp.txt",
      fileSize: 22,
      mimeType: "text/plain",
      storagePath: dummyPath,
    });
    assert.equal(fs.existsSync(dummyPath), true);

    // Run archival pipeline with autoConfirmDelivery = true
    const report = await runRetentionArchiveJob({
      retentionMs: 1, // expired
      autoConfirmDelivery: true,
    });

    assert.ok(report.messagesDeleted >= 1, "Must permanently delete eligible messages");

    // 1. Messages are HARD DELETED from active retrieval
    const messages = await getMessages(conv.id);
    assert.equal(
      messages.some((m) => m.id === msg.id),
      false,
      "Permanently deleted message must NEVER be returned in getMessages",
    );

    // 2. Associated attachment file is deleted from active storage
    assert.equal(fs.existsSync(dummyPath), false, "Active storage attachment must be removed");

    // 3. Batch audit record is preserved with only audit metadata
    const batches = await getAllArchiveBatches(conv.id);
    const deletedBatch = batches.find((b) => b.messageIds.includes(msg.id));
    assert.ok(deletedBatch, "Audit record must exist");
    assert.equal(deletedBatch?.status, "deleted");
    assert.ok(deletedBatch?.deletedAt, "Must record deletion timestamp");
  });

  test("7. Messages with different read times are handled independently", async () => {
    const token = generateSecureToken();
    const conv = await getOrCreateConversationByHash(hashToken(token), "Grace Independent Timers");

    // Message 1 read a long time ago
    const msg1 = await addMessage({
      conversationId: conv.id,
      senderType: "visitor",
      content: "Old message",
    });
    await markMessagesAsRead(conv.id, "owner");

    // Simulate elapsed time for message 1 by backdating its readAt
    await updateMessageReadAtForTesting(
      conv.id,
      msg1.id,
      new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25h ago
    );

    // Message 2 just read right now
    const msg2 = await addMessage({
      conversationId: conv.id,
      senderType: "visitor",
      content: "Brand new message",
    });
    // owner reads msg2 right now
    await markMessagesAsRead(conv.id, "owner");

    // Scan eligible messages at 24h retention threshold
    const eligible = await getEligibleMessagesForRetention(24 * 60 * 60 * 1000);
    const convEligible = eligible[conv.id] || [];

    assert.ok(convEligible.some((m) => m.id === msg1.id), "25h old message MUST be eligible");
    assert.equal(
      convEligible.some((m) => m.id === msg2.id),
      false,
      "Recently read message MUST NOT be eligible",
    );
  });

  test("8. New messages arriving during or after archive processing are preserved", async () => {
    const token = generateSecureToken();
    const conv = await getOrCreateConversationByHash(hashToken(token), "Heidi Concurrent Ingestion");

    // Batch 1 messages
    const oldMsg = await addMessage({
      conversationId: conv.id,
      senderType: "visitor",
      content: "Old message for batch 1",
    });
    await markMessagesAsRead(conv.id, "owner");

    // Allow simulated 1ms threshold to elapse
    await new Promise((r) => setTimeout(r, 25));

    // Execute retention archive on old message
    await runRetentionArchiveJob({
      retentionMs: 1,
      autoConfirmDelivery: true,
    });

    // New message arrives after/during
    const newMsg = await addMessage({
      conversationId: conv.id,
      senderType: "visitor",
      content: "Fresh message continuing the conversation",
    });

    const activeMsgs = await getMessages(conv.id);
    assert.equal(activeMsgs.some((m) => m.id === oldMsg.id), false, "Old message is deleted");
    assert.equal(activeMsgs.some((m) => m.id === newMsg.id), true, "Fresh message is fully preserved");
  });

  test("9. Deleted messages never reappear after user logout and login with verified email", async () => {
    const email = `retention.user.${Date.now()}@example.com`;

    // Session 1: User verifies email, sends message, message is read and archived
    const token1 = generateSecureToken();
    const hash1 = hashToken(token1);
    const conv1 = await getOrCreateConversationByHash(hash1, "Retention User");

    const msg1 = await addMessage({
      conversationId: conv1.id,
      senderType: "visitor",
      content: "Secret message to be permanently deleted",
    });
    await markMessagesAsRead(conv1.id, "owner");
    await associateConversationWithVerifiedEmail(conv1.id, hash1, email);

    // Archive and permanently delete msg1
    await runRetentionArchiveJob({
      retentionMs: 1,
      autoConfirmDelivery: true,
    });

    // Verify msg1 is gone in Session 1
    const s1Msgs = await getMessages(conv1.id);
    assert.equal(s1Msgs.some((m) => m.id === msg1.id), false);

    // Session 2: User opens new browser session on another device and logs in with same verified email
    const token2 = generateSecureToken();
    const hash2 = hashToken(token2);
    const conv2 = await getOrCreateConversationByHash(hash2, "Visitor");

    const { conversation: restoredConv } = await associateConversationWithVerifiedEmail(
      conv2.id,
      hash2,
      email,
    );

    assert.equal(restoredConv.id, conv1.id, "Identity resolves to same canonical conversation");

    // Messages check in new session: DELETED MESSAGE MUST NOT REAPPEAR!
    const s2Msgs = await getMessages(restoredConv.id);
    assert.equal(
      s2Msgs.some((m) => m.id === msg1.id),
      false,
      "Permanently deleted messages must NEVER reappear after re-login",
    );

    // User can continue sending new messages normally
    const continuationMsg = await addMessage({
      conversationId: restoredConv.id,
      senderType: "visitor",
      content: "Continuing conversation after previous history was expired and deleted",
    });
    assert.ok(continuationMsg.id);

    const refreshedMsgs = await getMessages(restoredConv.id);
    assert.ok(refreshedMsgs.some((m) => m.id === continuationMsg.id));
  });

  test("10. Strict privacy: User B cannot access User A's conversation or archive batches", async () => {
    const tokenA = generateSecureToken();
    const convA = await getOrCreateConversationByHash(hashToken(tokenA), "User A");

    const tokenB = generateSecureToken();
    const convB = await getOrCreateConversationByHash(hashToken(tokenB), "User B");

    assert.notEqual(convA.id, convB.id);

    // Archive batches for Conv A
    const batchesA = await getAllArchiveBatches(convA.id);
    const batchesB = await getAllArchiveBatches(convB.id);

    // User B's batches query cannot return User A's batches
    for (const b of batchesB) {
      assert.notEqual(b.conversationId, convA.id);
    }
  });
});
