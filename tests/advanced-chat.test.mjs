import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

import {
  generateSecureToken,
  hashToken,
} from "../src/lib/live-chat/security.ts";

import {
  getOrCreateConversationByHash,
  addMessage,
  getMessages,
  editMessage,
  deleteMessage,
  toggleMessageReaction,
  createAttachmentRecord,
  getAttachmentById,
  archiveConversationByAdmin,
  deleteConversationByAdmin,
  getAllConversationsForAdmin,
  getFullConversationHistoryForPdf,
} from "../src/lib/live-chat/db.ts";

test("Advanced Live Chat: Editing, Deletion, Reactions, Attachments, and PDF Export Suite", async (t) => {
  const tokenA = generateSecureToken();
  const hashA = hashToken(tokenA);
  const convA = await getOrCreateConversationByHash(hashA);

  const tokenB = generateSecureToken();
  const hashB = hashToken(tokenB);
  const convB = await getOrCreateConversationByHash(hashB);

  // 1. Message Editing & Isolation
  await t.test("1. Visitor can edit own message, but cannot edit others' or deleted messages", async () => {
    const msg = await addMessage({
      conversationId: convA.id,
      senderType: "visitor",
      content: "Initial message from visitor A",
    });

    assert.equal(msg.content, "Initial message from visitor A");
    assert.equal(msg.isEdited, false);

    // Visitor A edits own message
    const edited = await editMessage(msg.id, "Edited message from visitor A", "visitor", convA.id);
    assert.ok(edited, "Message should be successfully edited");
    assert.equal(edited?.content, "Edited message from visitor A");
    assert.equal(edited?.isEdited, true);
    assert.ok(edited?.editedAt);

    // Visitor B attempts to edit Visitor A's message -> Must fail / return null
    const unauthorizedEdit = await editMessage(msg.id, "Hacked by visitor B", "visitor", convB.id);
    assert.equal(unauthorizedEdit, null, "Visitor B must NOT be able to edit Visitor A's message");

    // Owner cannot edit visitor's message
    const ownerUnauthorized = await editMessage(msg.id, "Owner hacking visitor", "owner");
    assert.equal(ownerUnauthorized, null, "Owner must NOT be able to edit visitor messages");
  });

  // 2. Message Soft Deletion
  await t.test("2. Soft deletion replaces content with placeholder and prevents further edits", async () => {
    const msg = await addMessage({
      conversationId: convA.id,
      senderType: "visitor",
      content: "Sensitive info that needs deletion",
    });

    // Unauthorized delete attempt from Visitor B
    const badDelete = await deleteMessage(msg.id, "visitor", convB.id);
    assert.equal(badDelete, false, "Visitor B must not delete Visitor A's message");

    // Authorized delete
    const successDelete = await deleteMessage(msg.id, "visitor", convA.id);
    assert.equal(successDelete, true);

    // Check message in list
    const messages = await getMessages(convA.id);
    const target = messages.find((m) => m.id === msg.id);
    assert.ok(target);
    assert.equal(target?.isDeleted, true);
    assert.equal(target?.content, "[Message deleted]");

    // Attempting to edit a deleted message must fail
    const editDeleted = await editMessage(msg.id, "Resurrected content", "visitor", convA.id);
    assert.equal(editDeleted, null, "Deleted message must not be editable");
  });

  // 3. Quoted Replies
  await t.test("3. Quoted replies link to original message and preserve sender snippet", async () => {
    const original = await addMessage({
      conversationId: convA.id,
      senderType: "visitor",
      content: "What is your hourly rate for full-stack contracts?",
    });

    const reply = await addMessage({
      conversationId: convA.id,
      senderType: "owner",
      content: "My standard rate depends on project scope, let's schedule a call.",
      replyToId: original.id,
    });

    assert.equal(reply.replyToId, original.id);
    assert.ok(reply.replyPreview);
    assert.equal(reply.replyPreview.id, original.id);
    assert.equal(reply.replyPreview.senderType, "visitor");
    assert.ok(reply.replyPreview.snippet.includes("hourly rate"));
  });

  // 4. Emoji Reactions Toggle & Concurrency
  await t.test("4. Emoji reactions toggle on and off independently for visitors and owner", async () => {
    const msg = await addMessage({
      conversationId: convA.id,
      senderType: "visitor",
      content: "Here is the project proposal link!",
    });

    // Visitor reacts with 👍
    let reactions = await toggleMessageReaction(msg.id, "👍", "visitor", convA.id);
    assert.deepEqual(reactions["👍"], ["visitor"]);

    // Owner also reacts with 👍
    reactions = await toggleMessageReaction(msg.id, "👍", "owner");
    assert.equal(reactions["👍"].length, 2);
    assert.ok(reactions["👍"].includes("visitor"));
    assert.ok(reactions["👍"].includes("owner"));

    // Visitor toggles 👍 OFF
    reactions = await toggleMessageReaction(msg.id, "👍", "visitor", convA.id);
    assert.deepEqual(reactions["👍"], ["owner"]);

    // Owner toggles 👍 OFF -> key is cleaned up
    reactions = await toggleMessageReaction(msg.id, "👍", "owner");
    assert.equal(reactions["👍"], undefined);

    // Visitor B cannot react to Visitor A's message
    const badReaction = await toggleMessageReaction(msg.id, "🔥", "visitor", convB.id);
    assert.deepEqual(badReaction, {});
  });

  // 5. Attachments Persistence & Conversation Scoping
  await t.test("5. Attachment records are scoped to conversation with metadata", async () => {
    const att = await createAttachmentRecord({
      conversationId: convA.id,
      fileName: "architecture-diagram.png",
      fileSize: 1048576, // 1MB
      mimeType: "image/png",
      storagePath: ".data/attachments/test-diagram.png",
    });

    assert.ok(att.id);
    assert.equal(att.conversationId, convA.id);
    assert.equal(att.fileName, "architecture-diagram.png");

    const fetched = await getAttachmentById(att.id);
    assert.ok(fetched);
    assert.equal(fetched?.id, att.id);
    assert.equal(fetched?.conversationId, convA.id);

    // Non-existent attachment ID
    const notFound = await getAttachmentById("invalid-id-xyz");
    assert.equal(notFound, null);
  });

  // 6. Admin Archiving and Soft Deletion
  await t.test("6. Admin can archive and soft-delete conversations without data loss", async () => {
    // Archive
    const archived = await archiveConversationByAdmin(convA.id, true);
    assert.equal(archived, true);

    const adminList = await getAllConversationsForAdmin({ status: "archived" });
    const foundArchived = adminList.find((c) => c.id === convA.id);
    assert.ok(foundArchived, "Archived conversation should appear in archived tab");

    // Unarchive
    await archiveConversationByAdmin(convA.id, false);

    // Soft delete
    const deleted = await deleteConversationByAdmin(convA.id);
    assert.equal(deleted, true);

    const adminListAfterDelete = await getAllConversationsForAdmin({ status: "all" });
    const foundDeleted = adminListAfterDelete.find((c) => c.id === convA.id);
    assert.equal(foundDeleted, undefined, "Deleted conversation should be excluded from active list");
  });

  // 7. Full Conversation PDF Export Verification
  await t.test("7. Generates valid A4 PDF document with conversation history", async () => {
    const convPdf = await getOrCreateConversationByHash(hashToken("pdf-test-token-123456789012345678901234567890"));
    await addMessage({
      conversationId: convPdf.id,
      senderType: "visitor",
      content: "Hello, this is a test message for PDF export generation.",
    });
    await addMessage({
      conversationId: convPdf.id,
      senderType: "owner",
      content: "Hi there! I am replying to verify that PDF export captures both sides clearly.",
    });

    const fullHistory = await getFullConversationHistoryForPdf(convPdf.id);
    assert.ok(fullHistory, "History must exist for PDF export");
    assert.equal(fullHistory.messages.length, 2);

    // Verify PDFDocument creation and serialization
    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    page.drawText("GANGANATHAN — LIVE CHAT TRANSCRIPT", {
      x: 50,
      y: 800,
      size: 14,
      font: helveticaBold,
      color: rgb(0.04, 0.45, 0.58),
    });

    page.drawText(`Visitor: ${fullHistory.conversation.visitorName}`, {
      x: 50,
      y: 775,
      size: 10,
      font: helvetica,
      color: rgb(0.2, 0.2, 0.2),
    });

    let currentY = 740;
    for (const msg of fullHistory.messages) {
      const isOwner = msg.senderType === "owner";
      page.drawText(`[${msg.createdAt}] ${isOwner ? "Ganganathan" : "Visitor"}:`, {
        x: 50,
        y: currentY,
        size: 9,
        font: helveticaBold,
        color: isOwner ? rgb(0.5, 0.1, 0.7) : rgb(0.1, 0.5, 0.7),
      });
      currentY -= 14;
      page.drawText(msg.content, {
        x: 60,
        y: currentY,
        size: 9,
        font: helvetica,
        color: rgb(0.1, 0.1, 0.1),
      });
      currentY -= 20;
    }

    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes);

    // Verify PDF header magic bytes
    assert.equal(pdfBuffer.subarray(0, 5).toString("utf-8"), "%PDF-", "Generated document must have valid PDF magic bytes");
    assert.ok(pdfBuffer.length > 500, "PDF buffer must have substantive content");
  });
});
