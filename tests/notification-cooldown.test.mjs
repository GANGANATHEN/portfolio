import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

// Set test environment configuration
process.env.EMAIL_NOTIFICATION_COOLDOWN_MINUTES = "10";
process.env.OWNER_EMAIL = "ganganathan.dev@gmail.com";
process.env.RESEND_API_KEY = ""; // Simulation mode (returns true without external network)

import {
  generateSecureToken,
  hashToken,
} from "../src/lib/live-chat/security.ts";

import {
  getOrCreateConversationByHash,
  updateConversationProfile,
  addMessage,
  getMessages,
  getConversationById,
} from "../src/lib/live-chat/db.ts";

import {
  notifyOwnerOfNewMessage,
  notifyVisitorOfOwnerReply,
} from "../src/lib/live-chat/email.ts";

describe("Independent Per-Conversation Notification Cooldown & Concurrency", () => {
  before(() => {
    // Ensure clean test database directory
    const dataDir = path.join(process.cwd(), ".data");
    const storeFile = path.join(dataDir, "live-chat-store.json");
    if (fs.existsSync(storeFile)) {
      try {
        fs.unlinkSync(storeFile);
      } catch {}
    }
  });

  test("1. Simultaneous first messages from Visitor A and Visitor B BOTH dispatch notifications", async () => {
    const tokenA = generateSecureToken();
    const tokenB = generateSecureToken();

    const hashA = hashToken(tokenA);
    const hashB = hashToken(tokenB);

    const convA = await getOrCreateConversationByHash(hashA, "Alice (Visitor A)");
    const convB = await getOrCreateConversationByHash(hashB, "Bob (Visitor B)");

    assert.notEqual(convA.id, convB.id, "Conversations must have unique IDs");

    // Both visitors send messages concurrently
    const [msgA, msgB] = await Promise.all([
      addMessage({
        conversationId: convA.id,
        senderType: "visitor",
        content: "Alice's first project inquiry",
      }),
      addMessage({
        conversationId: convB.id,
        senderType: "visitor",
        content: "Bob's first project inquiry",
      }),
    ]);

    assert.ok(msgA.id);
    assert.ok(msgB.id);

    // Concurrently trigger owner notifications at the exact same instant
    const [resultA, resultB] = await Promise.all([
      notifyOwnerOfNewMessage(convA, msgA.content),
      notifyOwnerOfNewMessage(convB, msgB.content),
    ]);

    // BOTH MUST BE SENT!
    assert.equal(
      resultA.status,
      "sent",
      "Visitor A's first message MUST dispatch an email notification to owner",
    );
    assert.equal(
      resultB.status,
      "sent",
      "Visitor B's first message MUST dispatch an email notification to owner",
    );

    // Verify independent timestamps in database
    const freshA = await getConversationById(convA.id);
    const freshB = await getConversationById(convB.id);

    assert.ok(freshA?.lastOwnerNotificationAt, "Conv A must have notification timestamp");
    assert.ok(freshB?.lastOwnerNotificationAt, "Conv B must have notification timestamp");
  });

  test("2. Repeated messages from Visitor A within cooldown are throttled, but messages are STILL saved", async () => {
    const tokenA = generateSecureToken();
    const hashA = hashToken(tokenA);
    const convA = await getOrCreateConversationByHash(hashA, "Alice (Visitor A)");

    // First message dispatches
    const msg1 = await addMessage({
      conversationId: convA.id,
      senderType: "visitor",
      content: "First message from Alice",
    });
    const res1 = await notifyOwnerOfNewMessage(convA, msg1.content);
    assert.equal(res1.status, "sent", "First message should be sent");

    // Rapid second message from Alice (100ms later)
    const msg2 = await addMessage({
      conversationId: convA.id,
      senderType: "visitor",
      content: "Follow-up message from Alice 2 seconds later",
    });
    const res2 = await notifyOwnerOfNewMessage(convA, msg2.content);

    // MUST BE THROTTLED
    assert.equal(
      res2.status,
      "throttled",
      "Repeated message from Alice within 10-minute cooldown MUST be throttled",
    );

    // Third message from Alice
    const msg3 = await addMessage({
      conversationId: convA.id,
      senderType: "visitor",
      content: "Third message from Alice",
    });
    const res3 = await notifyOwnerOfNewMessage(convA, msg3.content);
    assert.equal(res3.status, "throttled", "Third message must also be throttled");

    // CRITICAL: Verify that all 3 messages are STILL durably saved in conversation history
    const allMessages = await getMessages(convA.id);
    assert.equal(allMessages.length, 3, "All 3 messages must exist in the conversation thread");
    assert.equal(allMessages[0].content, "First message from Alice");
    assert.equal(allMessages[1].content, "Follow-up message from Alice 2 seconds later");
    assert.equal(allMessages[2].content, "Third message from Alice");
  });

  test("3. Visitor C's notification is NEVER suppressed because of Visitor A's throttled activity", async () => {
    // Visitor A was just throttled in the previous test.
    // Now a new visitor (Charlie) sends their first message.
    const tokenC = generateSecureToken();
    const hashC = hashToken(tokenC);
    const convC = await getOrCreateConversationByHash(hashC, "Charlie (Visitor C)");

    const msgC = await addMessage({
      conversationId: convC.id,
      senderType: "visitor",
      content: "Hello, Charlie here! First message.",
    });

    const resC = await notifyOwnerOfNewMessage(convC, msgC.content);

    assert.equal(
      resC.status,
      "sent",
      "Visitor C's first message must NOT be throttled just because Visitor A was throttled",
    );
  });

  test("4. Simultaneous burst of 5 messages from same visitor results in EXACTLY ONE email notification", async () => {
    const tokenD = generateSecureToken();
    const hashD = hashToken(tokenD);
    const convD = await getOrCreateConversationByHash(hashD, "Spammy Dan");

    // Dan fires 5 messages in parallel
    const contents = [
      "Burst message 1",
      "Burst message 2",
      "Burst message 3",
      "Burst message 4",
      "Burst message 5",
    ];

    const messages = await Promise.all(
      contents.map((content) =>
        addMessage({
          conversationId: convD.id,
          senderType: "visitor",
          content,
        }),
      ),
    );

    assert.equal(messages.length, 5);

    // Simultaneous notification calls
    const notifyResults = await Promise.all(
      messages.map((m) => notifyOwnerOfNewMessage(convD, m.content)),
    );

    const sentCount = notifyResults.filter((r) => r.status === "sent").length;
    const throttledCount = notifyResults.filter((r) => r.status === "throttled").length;

    // Concurrency guarantee: EXACTLY ONE dispatched, the other 4 throttled!
    assert.equal(sentCount, 1, "Concurrency lock MUST permit exactly 1 email notification");
    assert.equal(throttledCount, 4, "Concurrency lock MUST throttle the other 4 simultaneous messages");

    // All 5 messages exist in conversation
    const danMessages = await getMessages(convD.id);
    assert.equal(danMessages.length, 5, "All 5 messages must be preserved in Dan's conversation");
  });

  test("5. Visitor reply notifications have independent cooldowns per visitor", async () => {
    // Visitor 1 with verified email and notifications enabled
    const token1 = generateSecureToken();
    const hash1 = hashToken(token1);
    const conv1 = await getOrCreateConversationByHash(hash1, "Visitor One");
    await updateConversationProfile(hash1, {
      visitorEmail: "visitor1@example.com",
      emailNotificationsEnabled: true,
      emailVerified: true,
    });

    // Visitor 2 with verified email and notifications enabled
    const token2 = generateSecureToken();
    const hash2 = hashToken(token2);
    const conv2 = await getOrCreateConversationByHash(hash2, "Visitor Two");
    await updateConversationProfile(hash2, {
      visitorEmail: "visitor2@example.com",
      emailNotificationsEnabled: true,
      emailVerified: true,
    });

    // Owner replies to Visitor 1
    const reply1 = await notifyVisitorOfOwnerReply(
      {
        id: conv1.id,
        visitorName: "Visitor One",
        visitorEmail: "visitor1@example.com",
        emailVerified: true,
        emailNotificationsEnabled: true,
      },
      "Reply to Visitor 1",
    );
    assert.equal(reply1.status, "sent", "First reply to Visitor 1 must be sent");

    // Owner immediately replies to Visitor 1 again (should be throttled)
    const reply1Repeat = await notifyVisitorOfOwnerReply(
      {
        id: conv1.id,
        visitorName: "Visitor One",
        visitorEmail: "visitor1@example.com",
        emailVerified: true,
        emailNotificationsEnabled: true,
      },
      "Second quick reply to Visitor 1",
    );
    assert.equal(
      reply1Repeat.status,
      "throttled",
      "Repeated reply to Visitor 1 within cooldown must be throttled",
    );

    // Owner replies to Visitor 2
    const reply2 = await notifyVisitorOfOwnerReply(
      {
        id: conv2.id,
        visitorName: "Visitor Two",
        visitorEmail: "visitor2@example.com",
        emailVerified: true,
        emailNotificationsEnabled: true,
      },
      "Reply to Visitor 2",
    );
    assert.equal(
      reply2.status,
      "sent",
      "Visitor 2's reply MUST be sent and NOT throttled by Visitor 1's activity",
    );
  });
});

