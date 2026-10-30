import test from "node:test";
import assert from "node:assert/strict";

import {
  generateSecureToken,
  hashToken,
} from "../src/lib/live-chat/security.ts";

import {
  getOrCreateConversationByHash,
  addMessage,
  getMessages,
  deleteMessage,
  markMessagesAsRead,
  updateMessageReadAtForTesting,
  getEligibleMessagesForRetention,
  createArchiveBatchRecord,
  updateArchiveBatch,
  permanentlyDeleteArchivedMessages,
  updateConversationMetadata,
  getConversationById,
} from "../src/lib/live-chat/db.ts";

import {
  extractVisitorMetadata,
  parseUserAgent,
} from "../src/lib/metadata.ts";

import {
  createCommand,
  getPublicCommands,
  getAllCommandsForAdmin,
} from "../src/lib/commands/db.ts";

test("Visitor Message Deletion & Admin Audit Trail Suite", async (t) => {
  const tokenVisitor = generateSecureToken();
  const hashVisitor = hashToken(tokenVisitor);
  const conv = await getOrCreateConversationByHash(hashVisitor, "Visitor User");

  const otherToken = generateSecureToken();
  const otherHash = hashToken(otherToken);
  const otherConv = await getOrCreateConversationByHash(otherHash, "Stranger User");

  let visitorMsgId = "";
  const originalSecretText = "Hello! This is a sensitive enquiry that I want to delete later.";

  await t.test("1. Visitor sends a message and it appears in both visitor and admin view", async () => {
    const msg = await addMessage({
      conversationId: conv.id,
      senderType: "visitor",
      content: originalSecretText,
    });
    visitorMsgId = msg.id;
    assert.ok(visitorMsgId);

    const visitorView = await getMessages(conv.id, { role: "visitor" });
    const adminView = await getMessages(conv.id, { role: "owner" });

    assert.equal(visitorView.some((m) => m.id === visitorMsgId), true);
    assert.equal(adminView.some((m) => m.id === visitorMsgId), true);
  });

  await t.test("2. Stranger cannot delete visitor's message across conversations", async () => {
    const deleted = await deleteMessage(visitorMsgId, "visitor", otherConv.id);
    assert.equal(deleted, false, "Must reject cross-conversation deletion attempt");
  });

  await t.test("3. Visitor deletes own message: disappears from visitor view, but admin retains original content with red indicator metadata", async () => {
    const deleted = await deleteMessage(visitorMsgId, "visitor", conv.id);
    assert.equal(deleted, true);

    // Visitor view: Message is completely filtered out!
    const visitorView = await getMessages(conv.id, { role: "visitor" });
    const foundInVisitorView = visitorView.find((m) => m.id === visitorMsgId);
    assert.equal(foundInVisitorView, undefined, "Visitor deleted message MUST disappear completely from visitor view");

    // Admin view: Original content is preserved, with isDeleted: true and deletedBy: 'visitor'
    const adminView = await getMessages(conv.id, { role: "owner" });
    const foundInAdminView = adminView.find((m) => m.id === visitorMsgId);
    assert.ok(foundInAdminView, "Admin must still have full visibility of the message");
    assert.equal(foundInAdminView.isDeleted, true);
    assert.equal(foundInAdminView.deletedBy, "visitor");
    assert.equal(foundInAdminView.content, originalSecretText, "Admin must see original content, not a blank or generic placeholder");
    assert.ok(foundInAdminView.deletedAt);
  });

  await t.test("4. Admin deletion: explicitly replaces content with '[Message deleted]' and marks deletedBy: 'owner'", async () => {
    const ownerMsg = await addMessage({
      conversationId: conv.id,
      senderType: "owner",
      content: "Owner reply that gets soft deleted",
    });

    const deleted = await deleteMessage(ownerMsg.id, "owner", conv.id);
    assert.equal(deleted, true);

    const adminView = await getMessages(conv.id, { role: "owner" });
    const foundOwnerMsg = adminView.find((m) => m.id === ownerMsg.id);
    assert.ok(foundOwnerMsg);
    assert.equal(foundOwnerMsg.isDeleted, true);
    assert.equal(foundOwnerMsg.deletedBy, "owner");
    assert.equal(foundOwnerMsg.content, "[Message deleted]");
  });
});

test("24-Hour Retention Integration with Visitor-Deleted Messages Suite", async (t) => {
  const token = generateSecureToken();
  const hash = hashToken(token);
  const conv = await getOrCreateConversationByHash(hash, "Retention Visitor");

  let msgId = "";

  await t.test("1. Unread visitor-deleted message is NEVER eligible for retention deletion before readAt is stamped", async () => {
    const msg = await addMessage({
      conversationId: conv.id,
      senderType: "visitor",
      content: "Unread message deleted by visitor",
    });
    msgId = msg.id;

    // Visitor immediately deletes message while admin hasn't read it yet
    await deleteMessage(msgId, "visitor", conv.id);

    // Verify it is not eligible for 24-hour retention deletion
    const eligibleBeforeRead = await getEligibleMessagesForRetention(24 * 60 * 60 * 1000);
    const eligibleList = eligibleBeforeRead[conv.id] || [];
    assert.equal(eligibleList.some((m) => m.id === msgId), false, "Unread message must not be deleted, even if deleted by visitor");
  });

  await t.test("2. Admin reads message: 24-hour countdown starts; not deleted at 23h59m", async () => {
    // Admin marks messages as read
    await markMessagesAsRead(conv.id, "owner");

    // Fast-forward readAt to 23 hours ago
    const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
    await updateMessageReadAtForTesting(conv.id, msgId, twentyThreeHoursAgo);

    const eligibleAt23h = await getEligibleMessagesForRetention(24 * 60 * 60 * 1000);
    const listAt23h = eligibleAt23h[conv.id] || [];
    assert.equal(listAt23h.some((m) => m.id === msgId), false, "Must not be eligible before full 24 hours expire");
  });

  await t.test("3. Message reaches 24 hours: eligible for batching, archived to PDF, and permanently deleted upon confirmed delivery", async () => {
    // Fast-forward readAt to 25 hours ago
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    await updateMessageReadAtForTesting(conv.id, msgId, twentyFiveHoursAgo);

    const eligibleAt25h = await getEligibleMessagesForRetention(24 * 60 * 60 * 1000);
    const listAt25h = eligibleAt25h[conv.id] || [];
    assert.equal(listAt25h.some((m) => m.id === msgId), true, "Must become eligible after 24 hours");

    // Create archive batch
    const batch = await createArchiveBatchRecord({
      conversationId: conv.id,
      messageIds: [msgId],
      messageCount: 1,
      cutoffReadAt: twentyFiveHoursAgo,
    });
    assert.ok(batch.id);

    // Simulated successful email delivery
    await updateArchiveBatch(batch.id, {
      status: "delivered",
      emailMessageId: "msg_delivered_123",
      emailDeliveryConfirmedAt: new Date().toISOString(),
    });

    // Permanently purge from database
    const { deletedCount } = await permanentlyDeleteArchivedMessages(conv.id, [msgId]);
    assert.equal(deletedCount, 1);

    // After permanent deletion, admin view no longer contains the message
    const adminView = await getMessages(conv.id, { role: "owner" });
    assert.equal(adminView.some((m) => m.id === msgId), false, "Must be permanently deleted from database");
  });
});

test("Visitor & Device Metadata Collection Suite (Commands & Live Chat)", async (t) => {
  await t.test("1. Parses rich User Agent headers into browser, version, engine, OS, and device type", () => {
    const desktopChromeUA =
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";
    const parsedChrome = parseUserAgent(desktopChromeUA);
    assert.equal(parsedChrome.browserFamily, "Chrome");
    assert.equal(parsedChrome.browserVersion, "142.0.0.0");
    assert.equal(parsedChrome.browserEngine, "Blink");
    assert.equal(parsedChrome.osFamily, "Linux");
    assert.equal(parsedChrome.deviceType, "desktop");

    const mobileSafariUA =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
    const parsedIphone = parseUserAgent(mobileSafariUA);
    assert.equal(parsedIphone.browserFamily, "Safari");
    assert.equal(parsedIphone.browserVersion, "18.1");
    assert.equal(parsedIphone.browserEngine, "WebKit");
    assert.equal(parsedIphone.osFamily, "iOS");
    assert.equal(parsedIphone.osVersion, "18.1");
    assert.equal(parsedIphone.deviceType, "mobile");
  });

  await t.test("2. Extracts Vercel edge IP geolocation and client screen telemetry cleanly", () => {
    const mockReq = {
      headers: new Map([
        ["user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0"],
        ["x-forwarded-for", "203.0.113.195, 10.0.0.1"],
        ["x-vercel-ip-country", "IN"],
        ["x-vercel-ip-country-region", "TN"],
        ["x-vercel-ip-city", "Chennai"],
        ["x-vercel-ip-latitude", "13.0827"],
        ["x-vercel-ip-longitude", "80.2707"],
        ["x-vercel-ip-timezone", "Asia/Kolkata"],
      ]),
    };

    const clientTelemetry = {
      screenResolution: "1920x1080",
      viewportDimensions: "1440x880",
      deviceLanguage: "en-US",
      timezone: "Asia/Kolkata",
    };

    const meta = extractVisitorMetadata(
      { headers: { get: (k) => mockReq.headers.get(k.toLowerCase()) || null } },
      clientTelemetry,
    );

    assert.equal(meta.ip, "203.0.113.195");
    assert.equal(meta.country, "IN");
    assert.equal(meta.region, "TN");
    assert.equal(meta.city, "Chennai");
    assert.equal(meta.approxLatitude, 13.0827);
    assert.equal(meta.approxLongitude, 80.2707);
    assert.equal(meta.locationSource, "ip_derived_approximate");
    assert.equal(meta.screenResolution, "1920x1080");
    assert.equal(meta.viewportDimensions, "1440x880");
    assert.equal(meta.timezone, "Asia/Kolkata");
    assert.equal(meta.browserFamily, "Firefox");
    assert.equal(meta.osFamily, "Windows");
  });

  await t.test("3. Records Unavailable reason when headers are missing, without fabricating location", () => {
    const localReq = {
      headers: new Map([
        ["user-agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"],
        ["x-real-ip", "127.0.0.1"],
      ]),
    };

    const meta = extractVisitorMetadata({
      headers: { get: (k) => localReq.headers.get(k.toLowerCase()) || null },
    });

    assert.equal(meta.ip, "127.0.0.1");
    assert.equal(meta.locationSource, "unavailable");
    assert.ok(meta.locationUnavailableReason);
    assert.equal(meta.city, undefined);
  });

  await t.test("4. Commands metadata: publicCommands strips metadata; adminCommands exposes full metadata", async () => {
    const testCmd = await createCommand(
      {
        command: "git status --short",
        author_name: "PrivacyTester",
        category: "Git",
      },
      {
        ip: "203.0.113.50",
        browserFamily: "Chrome",
        osFamily: "Linux",
        deviceType: "desktop",
        city: "Chennai",
        country: "IN",
      },
    );

    const publicList = await getPublicCommands();
    const publicCmd = publicList.find((c) => c.id === testCmd.id);
    assert.ok(publicCmd);
    assert.equal("metadata" in publicCmd, false, "Public command must NEVER leak private metadata");

    const adminList = await getAllCommandsForAdmin();
    const adminCmd = adminList.find((c) => c.id === testCmd.id);
    assert.ok(adminCmd);
    assert.ok(adminCmd.metadata);
    assert.equal(adminCmd.metadata.ip, "203.0.113.50");
    assert.equal(adminCmd.metadata.city, "Chennai");
  });

  await t.test("5. Live Chat metadata: persists in conversation and accessible to admin", async () => {
    const token = generateSecureToken();
    const hash = hashToken(token);
    const conv = await getOrCreateConversationByHash(hash, "Telemetry Visitor");

    const meta = {
      ip: "198.51.100.4",
      userAgent: "Test Agent",
      deviceType: "desktop",
      osFamily: "Linux",
      browserFamily: "Chrome",
      city: "San Francisco",
      country: "US",
      locationSource: "ip_derived_approximate",
      collectedAt: new Date().toISOString(),
    };

    await updateConversationMetadata(conv.id, meta);

    const refreshed = await getConversationById(conv.id);
    assert.ok(refreshed);
    assert.ok(refreshed.metadata);
    assert.equal(refreshed.metadata.city, "San Francisco");
    assert.equal(refreshed.metadata.country, "US");
    assert.equal(refreshed.metadata.ip, "198.51.100.4");
  });
});
