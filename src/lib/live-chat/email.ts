import type { Conversation } from "./types";
import { claimNotificationLock, logNotification } from "./db";

const DEFAULT_COOLDOWN_MINUTES = 10;

function getCooldownMs(): number {
  const configured = parseInt(process.env.EMAIL_NOTIFICATION_COOLDOWN_MINUTES || "", 10);
  const minutes = !isNaN(configured) && configured >= 1 ? configured : DEFAULT_COOLDOWN_MINUTES;
  return minutes * 60 * 1000;
}

function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Send an email via Resend if RESEND_API_KEY is configured
 */
export async function sendEmailViaResend({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey.includes("your-resend-api-key")) {
    console.log(`[Email Notification Sim] To: ${to} | Subject: ${subject}`);
    return true; // Graceful simulation when key not provided
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || "Ganganathan Portfolio <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        html,
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      console.warn("[Resend Email Error]:", data);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Email Dispatch Exception]:", err);
    return false;
  }
}

/**
 * Notify Portfolio Owner of a new visitor message
 * - Cooldown is strictly independent per conversation (Conversation A activity never suppresses Conversation B).
 * - Uses atomic database lock claim to prevent race conditions on simultaneous messages.
 */
export async function notifyOwnerOfNewMessage(
  conversation: Pick<Conversation, "id" | "visitorName" | "visitorEmail">,
  messageContent: string,
): Promise<{ status: "sent" | "throttled" | "failed" }> {
  const ownerEmail = process.env.OWNER_EMAIL || "ganganathan.dev@gmail.com";
  const cooldownMs = getCooldownMs();
  const preview = messageContent.slice(0, 160);

  // 1. ATOMIC LOCK CLAIM
  // Concurrency-safe: claims lock ONLY if no notification for THIS conversation occurred within cooldown window
  const lockClaimed = await claimNotificationLock(conversation.id, "owner", cooldownMs);

  if (!lockClaimed) {
    await logNotification({
      conversationId: conversation.id,
      recipientType: "owner",
      recipientEmail: ownerEmail,
      status: "throttled",
      messagePreview: preview,
    });
    return { status: "throttled" };
  }

  // 2. Lock claimed successfully: proceed with email dispatch
  const siteUrl = getSiteUrl();
  const inboxLink = `${siteUrl}/admin/inbox`;
  const visitorDisplay = conversation.visitorName || "A visitor";

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; background: #0a0a0c; color: #f3f3f3; padding: 32px; border-radius: 16px; border: 1px solid #27272a;">
      <div style="margin-bottom: 24px;">
        <span style="background: #915eff; color: white; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">Live Portfolio Chat</span>
      </div>
      <h2 style="font-size: 20px; font-weight: bold; margin: 0 0 16px; color: #ffffff;">New message from ${visitorDisplay}</h2>
      <div style="background: rgba(255, 255, 255, 0.05); padding: 16px; border-radius: 12px; border-left: 3px solid #915eff; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 15px; line-height: 1.5; color: #e4e4e7;">"${preview}${messageContent.length > 160 ? "..." : ""}"</p>
      </div>
      ${conversation.visitorEmail ? `<p style="font-size: 13px; color: #a1a1aa; margin-bottom: 20px;">Visitor Email: <strong>${conversation.visitorEmail}</strong></p>` : ""}
      <div style="margin-top: 24px;">
        <a href="${inboxLink}" style="display: inline-block; background: #915eff; color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 14px;">Open Admin Inbox & Reply →</a>
      </div>
      <p style="font-size: 11px; color: #71717a; margin-top: 32px; border-top: 1px solid #27272a; padding-top: 16px;">
        Notification throttled to once per ${Math.round(cooldownMs / 60000)} minutes per conversation.
      </p>
    </div>
  `;

  const success = await sendEmailViaResend({
    to: ownerEmail,
    subject: `[Live Chat] New message from ${visitorDisplay}`,
    html,
  });

  const finalStatus = success ? "sent" : "failed";
  await logNotification({
    conversationId: conversation.id,
    recipientType: "owner",
    recipientEmail: ownerEmail,
    status: finalStatus,
    messagePreview: preview,
  });

  return { status: finalStatus };
}

/**
 * Notify Visitor of an Owner reply
 * - Strict per-visitor independent cooldown tracking.
 * - Requires visitor email and explicit consent.
 */
export async function notifyVisitorOfOwnerReply(
  conversation: Pick<Conversation, "id" | "visitorName" | "visitorEmail" | "emailNotificationsEnabled">,
  replyContent: string,
): Promise<{ status: "sent" | "throttled" | "failed" | "skipped" }> {
  // Visitor must have provided a valid email and enabled notifications
  if (!conversation.visitorEmail || !conversation.emailNotificationsEnabled) {
    return { status: "skipped" };
  }

  const cooldownMs = getCooldownMs();
  const preview = replyContent.slice(0, 160);

  // 1. ATOMIC LOCK CLAIM FOR VISITOR REPLY
  const lockClaimed = await claimNotificationLock(conversation.id, "visitor", cooldownMs);

  if (!lockClaimed) {
    await logNotification({
      conversationId: conversation.id,
      recipientType: "visitor",
      recipientEmail: conversation.visitorEmail,
      status: "throttled",
      messagePreview: preview,
    });
    return { status: "throttled" };
  }

  // 2. Lock claimed: dispatch email
  const siteUrl = getSiteUrl();
  const chatLink = `${siteUrl}/?live_chat=open`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; background: #0a0a0c; color: #f3f3f3; padding: 32px; border-radius: 16px; border: 1px solid #27272a;">
      <div style="margin-bottom: 24px;">
        <span style="background: #22d3ee; color: #000000; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">Ganganathan replied</span>
      </div>
      <h2 style="font-size: 20px; font-weight: bold; margin: 0 0 16px; color: #ffffff;">Hi ${conversation.visitorName || "there"},</h2>
      <p style="color: #a1a1aa; font-size: 14px; margin-bottom: 16px;">Ganganathan replied to your message on his portfolio:</p>
      <div style="background: rgba(255, 255, 255, 0.05); padding: 16px; border-radius: 12px; border-left: 3px solid #22d3ee; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 15px; line-height: 1.5; color: #e4e4e7;">"${preview}${replyContent.length > 160 ? "..." : ""}"</p>
      </div>
      <div style="margin-top: 24px;">
        <a href="${chatLink}" style="display: inline-block; background: #22d3ee; color: #000000; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 14px;">Continue Live Conversation →</a>
      </div>
      <p style="font-size: 11px; color: #71717a; margin-top: 32px; border-top: 1px solid #27272a; padding-top: 16px;">
        You received this because you opted in for email notifications on Ganganathan's portfolio.
      </p>
    </div>
  `;

  const success = await sendEmailViaResend({
    to: conversation.visitorEmail,
    subject: `Ganganathan replied to your message`,
    html,
  });

  const finalStatus = success ? "sent" : "failed";
  await logNotification({
    conversationId: conversation.id,
    recipientType: "visitor",
    recipientEmail: conversation.visitorEmail,
    status: finalStatus,
    messagePreview: preview,
  });

  return { status: finalStatus };
}
