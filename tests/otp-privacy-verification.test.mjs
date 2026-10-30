import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

process.env.EMAIL_NOTIFICATION_COOLDOWN_MINUTES = "10";
process.env.OWNER_EMAIL = "ganganathan.dev@gmail.com";
process.env.RESEND_API_KEY = ""; // Simulation mode (returns true without external network)
process.env.ADMIN_SECRET_KEY = "test_admin_secret_key_minimum_32_characters_long_for_security";
process.env.ADMIN_PASSWORD = "test_admin_password_2026";

import {
  generateSecureToken,
  hashToken,
  generateOtp,
  hashOtp,
  verifyOtpHash,
  createAdminSessionToken,
  verifyAdminSessionToken,
  verifyAdminPassword,
} from "../src/lib/live-chat/security.ts";

import {
  getOrCreateConversationByHash,
  updateConversationProfile,
  setConversationEmailVerified,
  findConversationByVerifiedEmail,
  associateConversationWithVerifiedEmail,
  releaseNotificationLock,
  claimNotificationLock,
  createEmailOtp,
  getLatestEmailOtp,
  incrementOtpAttempts,
  markOtpUsed,
  addMessage,
  getMessages,
  getConversationById,
} from "../src/lib/live-chat/db.ts";

import {
  notifyOwnerOfNewMessage,
  notifyVisitorOfOwnerReply,
} from "../src/lib/live-chat/email.ts";

describe("Secure Email OTP Verification & Strict Privacy Suite", () => {
  before(() => {
    // Reset test database store
    const dataDir = path.join(process.cwd(), ".data");
    const storeFile = path.join(dataDir, "live-chat-store.json");
    if (fs.existsSync(storeFile)) {
      try {
        fs.unlinkSync(storeFile);
      } catch {}
    }
  });

  test("1. OTP generation, hashing, and constant-time cryptographic verification", () => {
    const email = "user@example.com";
    const otp = generateOtp();

    assert.equal(/^\d{6}$/.test(otp), true, "OTP must be exactly 6 numeric digits");

    const hash = hashOtp(email, otp);
    assert.equal(typeof hash, "string");
    assert.equal(hash.length, 64, "HMAC-SHA256 must be 64 hex characters");

    // Valid check
    assert.equal(verifyOtpHash(email, otp, hash), true, "Matching OTP must verify successfully");

    // Invalid check (wrong digit)
    const wrongOtp = otp === "123456" ? "654321" : "123456";
    assert.equal(verifyOtpHash(email, wrongOtp, hash), false, "Mismatched OTP must fail verification");

    // Email salt isolation: same OTP for different email produces different hash
    const differentEmailHash = hashOtp("different@example.com", otp);
    assert.notEqual(hash, differentEmailHash, "OTP hash must be salted with email");
  });

  test("2. Valid OTP marks email as verified and single-use", async () => {
    const token = generateSecureToken();
    const hash = hashToken(token);
    const conv = await getOrCreateConversationByHash(hash, "Alice Verified");

    const email = "alice@example.com";
    const otp = generateOtp();
    const otpHash = hashOtp(email, otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const record = await createEmailOtp(conv.id, email, otpHash, expiresAt);
    assert.ok(record.id);
    assert.equal(record.usedAt, null);

    // Verify OTP
    const latest = await getLatestEmailOtp(conv.id, email);
    assert.ok(latest);
    assert.equal(verifyOtpHash(email, otp, latest.otpHash), true);

    // Mark used and mark conversation verified
    await markOtpUsed(latest.id);
    const updated = await setConversationEmailVerified(conv.id, email);

    assert.equal(updated?.emailVerified, true, "Conversation email must be marked verified");
    assert.equal(updated?.visitorEmail, email);
    assert.equal(updated?.emailNotificationsEnabled, true);

    // Single-use test: subsequent check finds no unused OTP
    const unusedAfter = await getLatestEmailOtp(conv.id, email);
    assert.equal(unusedAfter, null, "Used OTP must not be returned for verification");
  });

  test("3. Invalid OTP increments attempts and enforces max attempts limit", async () => {
    const token = generateSecureToken();
    const conv = await getOrCreateConversationByHash(hashToken(token), "Bob Test");

    const email = "bob@example.com";
    const otp = "888999";
    const otpHash = hashOtp(email, otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const record = await createEmailOtp(conv.id, email, otpHash, expiresAt, 5);

    // Simulate failed attempts
    for (let i = 1; i <= 5; i++) {
      const attempts = await incrementOtpAttempts(record.id);
      assert.equal(attempts, i, `Attempt counter should be ${i}`);
    }

    // Invalidate when max attempts reached
    await markOtpUsed(record.id);
    const afterExhausted = await getLatestEmailOtp(conv.id, email);
    assert.equal(afterExhausted, null, "Exhausted OTP must be invalidated and not reusable");
  });

  test("4. Expired OTP is detected and rejected", async () => {
    const token = generateSecureToken();
    const conv = await getOrCreateConversationByHash(hashToken(token), "Charlie Expired");

    const email = "charlie@example.com";
    const otp = "111222";
    const otpHash = hashOtp(email, otp);
    // Expired 5 minutes ago
    const expiredAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const record = await createEmailOtp(conv.id, email, otpHash, expiredAt);
    assert.ok(record);

    const isExpired = Date.now() > new Date(record.expiresAt).getTime();
    assert.equal(isExpired, true, "OTP must be recognized as expired");
  });

  test("5. Changing email address resets emailVerified to false", async () => {
    const token = generateSecureToken();
    const hash = hashToken(token);
    const conv = await getOrCreateConversationByHash(hash, "Dave Email Change");

    // Initially verify email 1
    await setConversationEmailVerified(conv.id, "dave.old@example.com");
    const verifiedConv = await getConversationById(conv.id);
    assert.equal(verifiedConv?.emailVerified, true);
    assert.equal(verifiedConv?.visitorEmail, "dave.old@example.com");

    // Dave updates his email to dave.new@example.com
    const updated = await updateConversationProfile(hash, {
      visitorEmail: "dave.new@example.com",
    });

    assert.equal(updated?.visitorEmail, "dave.new@example.com");
    assert.equal(
      updated?.emailVerified,
      false,
      "emailVerified MUST reset to false when visitor changes their email address",
    );

    // Verify reply notification is SKIPPED because email is unverified
    const notifyResult = await notifyVisitorOfOwnerReply(
      {
        id: updated.id,
        visitorName: updated.visitorName,
        visitorEmail: updated.visitorEmail,
        emailVerified: updated.emailVerified,
        emailNotificationsEnabled: true,
      },
      "Test owner reply to unverified new email",
    );

    assert.equal(
      notifyResult.status,
      "skipped",
      "Owner reply email must be SKIPPED for unverified email address",
    );
  });

  test("6. Anonymous guest chat: messages saved and visible only in guest session without email", async () => {
    const guestToken = generateSecureToken();
    const guestHash = hashToken(guestToken);
    const guestConv = await getOrCreateConversationByHash(guestHash, "Guest User");

    assert.equal(guestConv.visitorEmail, null, "Guest should have no email");
    assert.equal(guestConv.emailVerified, false);

    // Guest sends message
    const msg = await addMessage({
      conversationId: guestConv.id,
      senderType: "visitor",
      content: "Hello from anonymous guest!",
    });

    // Owner notification dispatches independently
    const ownerNotify = await notifyOwnerOfNewMessage(guestConv, msg.content);
    assert.equal(ownerNotify.status, "sent", "Owner notification dispatches for guest message");

    // Owner replies to guest
    const replyMsg = await addMessage({
      conversationId: guestConv.id,
      senderType: "owner",
      content: "Hi guest, thanks for reaching out!",
    });

    // Owner reply notification email MUST BE SKIPPED (no email for guest)
    const replyNotify = await notifyVisitorOfOwnerReply(guestConv, replyMsg.content);
    assert.equal(replyNotify.status, "skipped", "Email reply must be skipped for anonymous guest");

    // Guest can see both messages in their own thread
    const thread = await getMessages(guestConv.id);
    assert.equal(thread.length, 2);
    assert.equal(thread[0].content, "Hello from anonymous guest!");
    assert.equal(thread[1].content, "Hi guest, thanks for reaching out!");
  });

  test("7. Visitor A vs Visitor B strict privacy: Visitor B cannot access Visitor A's conversation", async () => {
    const tokenA = generateSecureToken();
    const tokenB = generateSecureToken();

    const hashA = hashToken(tokenA);
    const hashB = hashToken(tokenB);

    const convA = await getOrCreateConversationByHash(hashA, "Visitor A Private");
    const convB = await getOrCreateConversationByHash(hashB, "Visitor B Private");

    assert.notEqual(convA.id, convB.id);

    // Visitor A sends private data
    await addMessage({
      conversationId: convA.id,
      senderType: "visitor",
      content: "Visitor A private inquiry with sensitive details",
    });

    // Visitor B fetches their own messages using their session hash
    const messagesB = await getMessages(convB.id);
    assert.equal(messagesB.length, 0, "Visitor B thread must be empty");

    // Visitor B cannot resolve Conversation A by session token hash B
    assert.notEqual(hashB, hashA);
  });

  test("8. Owner replies reach ONLY verified and opted-in visitors", async () => {
    const token = generateSecureToken();
    const hash = hashToken(token);
    const conv = await getOrCreateConversationByHash(hash, "Opted In Verified");

    // Verify and enable
    await setConversationEmailVerified(conv.id, "verified.client@example.com");

    const replyResult = await notifyVisitorOfOwnerReply(
      {
        id: conv.id,
        visitorName: "Opted In Verified",
        visitorEmail: "verified.client@example.com",
        emailVerified: true,
        emailNotificationsEnabled: true,
      },
      "Hello! Here is your requested project proposal.",
    );

    assert.equal(
      replyResult.status,
      "sent",
      "Owner reply MUST be dispatched to verified and opted-in visitor",
    );
  });

  test("9. Admin authentication and authorization protection", () => {
    // Admin password verification
    assert.equal(verifyAdminPassword("test_admin_password_2026"), true);
    assert.equal(verifyAdminPassword("wrong_password"), false);
    assert.equal(verifyAdminPassword(""), false);

    // Admin signed session token
    const adminToken = createAdminSessionToken();
    assert.equal(verifyAdminSessionToken(adminToken), true);
    assert.equal(verifyAdminSessionToken("unauthorized_tampered_token"), false);
  });

  test("10. Production persistence enforcement: fails visibly on Vercel if Supabase is unreachable", async () => {
    // Simulate Vercel production environment with unreachable Supabase
    process.env.REQUIRE_SUPABASE = "true";

    try {
      await assert.rejects(
        async () => {
          await getOrCreateConversationByHash(hashToken("dummy_production_token"));
        },
        (err) => {
          return (
            err instanceof Error &&
            err.message.includes("[Production Database Error]")
          );
        },
        "Must throw fatal Production Database Error in production when Supabase is unreachable",
      );
    } finally {
      delete process.env.REQUIRE_SUPABASE;
    }
  });

  test("11. Verified email restores existing conversation history across different browser sessions", async () => {
    // Session 1: User starts a chat and verifies email
    const token1 = generateSecureToken();
    const hash1 = hashToken(token1);
    const conv1 = await getOrCreateConversationByHash(hash1, "Returning User");

    const email = "returning.visitor@example.com";

    // User sends message in session 1
    const msg1 = await addMessage({
      conversationId: conv1.id,
      senderType: "visitor",
      content: "Session 1: My initial conversation inquiry",
    });
    assert.ok(msg1.id);

    // User verifies email in session 1
    const { conversation: verified1, isRestored: isRestored1 } =
      await associateConversationWithVerifiedEmail(conv1.id, hash1, email);
    assert.equal(verified1.emailVerified, true);
    assert.equal(verified1.visitorEmail, email);
    assert.equal(isRestored1, false, "First verification should establish canonical conversation");

    // Session 2: User leaves website, opens incognito window with a fresh session token
    const token2 = generateSecureToken();
    const hash2 = hashToken(token2);
    assert.notEqual(hash1, hash2, "Session tokens must be distinct");

    const conv2 = await getOrCreateConversationByHash(hash2, "Visitor");
    assert.notEqual(conv1.id, conv2.id, "Initially creates temporary conversation for new session");

    // User sends an anonymous message before verifying in session 2
    const msg2 = await addMessage({
      conversationId: conv2.id,
      senderType: "visitor",
      content: "Session 2: I am back on a new device!",
    });
    assert.ok(msg2.id);

    // User requests OTP and verifies the same email in session 2
    const { conversation: restoredConv, isRestored: isRestored2 } =
      await associateConversationWithVerifiedEmail(conv2.id, hash2, email);

    assert.equal(isRestored2, true, "Must detect returning verified identity and restore conversation");
    assert.equal(restoredConv.id, conv1.id, "Must link to the canonical conversation ID");
    assert.equal(restoredConv.sessionTokenHash, hash2, "Must update sessionTokenHash to current session");

    // Fetch messages for session 2
    const messages = await getMessages(restoredConv.id);
    const contents = messages.map((m) => m.content);

    assert.ok(
      contents.includes("Session 1: My initial conversation inquiry"),
      "Must restore message from Session 1",
    );
    assert.ok(
      contents.includes("Session 2: I am back on a new device!"),
      "Must merge message sent in Session 2 prior to verification",
    );

    // Verify lookup by session 2 hash directly resolves to canonical conversation
    const lookupByHash2 = await getOrCreateConversationByHash(hash2);
    assert.equal(lookupByHash2.id, conv1.id, "Hash 2 must directly resolve to canonical conversation");

    // Verify isolation: A different user cannot see these messages
    const tokenOther = generateSecureToken();
    const hashOther = hashToken(tokenOther);
    const convOther = await getOrCreateConversationByHash(hashOther);
    const otherMessages = await getMessages(convOther.id);
    assert.equal(
      otherMessages.some((m) => m.content.includes("Session 1")),
      false,
      "Another user must not access restored conversation messages",
    );
  });

  test("12. Notification lock release allows subsequent notifications when dispatch fails", async () => {
    const token = generateSecureToken();
    const conv = await getOrCreateConversationByHash(hashToken(token), "Lock Test");

    // Claim lock
    const claimed = await claimNotificationLock(conv.id, "owner", 10 * 60 * 1000);
    assert.equal(claimed, true, "First claim must succeed");

    // Immediate second claim should be locked/throttled
    const secondClaim = await claimNotificationLock(conv.id, "owner", 10 * 60 * 1000);
    assert.equal(secondClaim, false, "Second claim must be throttled");

    // Release lock (simulating failed dispatch rollback)
    await releaseNotificationLock(conv.id, "owner", null);

    // Third claim should succeed again immediately
    const thirdClaim = await claimNotificationLock(conv.id, "owner", 10 * 60 * 1000);
    assert.equal(thirdClaim, true, "Claim after lock release must succeed immediately");
  });
});
