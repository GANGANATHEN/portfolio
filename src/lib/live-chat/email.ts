import type { Conversation } from "./types";
import { claimNotificationLock, releaseNotificationLock, logNotification } from "./db";
import crypto from "crypto";

const DEFAULT_COOLDOWN_MINUTES = 10;

export interface NotificationLogEvent {
  correlationId: string;
  eventType: "owner_new_message" | "visitor_owner_reply" | "visitor_otp" | "archive_pdf";
  status: "sent" | "throttled" | "failed" | "skipped" | "simulated";
  recipientDomain: string;
  providerErrorCategory?:
    | "missing_key"
    | "auth_error"
    | "domain_verification_required"
    | "rate_limit"
    | "provider_outage"
    | "unknown";
  timestamp: string;
}

/**
 * Sanitized, structured server logger. Never logs secrets, OTP values, or sensitive message contents.
 */
function logNotificationStructured(event: NotificationLogEvent): void {
  const sanitized = {
    correlationId: event.correlationId,
    eventType: event.eventType,
    status: event.status,
    recipientDomain: event.recipientDomain,
    providerErrorCategory: event.providerErrorCategory || "none",
    timestamp: event.timestamp,
  };
  console.log(`[Notification Engine] ${JSON.stringify(sanitized)}`);
}

function getRecipientDomain(email: string): string {
  try {
    const parts = email.split("@");
    return parts.length === 2 ? parts[1].toLowerCase() : "unknown";
  } catch {
    return "unknown";
  }
}

function getCooldownMs(): number {
  const configured = parseInt(process.env.EMAIL_NOTIFICATION_COOLDOWN_MINUTES || "", 10);
  const minutes = !isNaN(configured) && configured >= 1 ? configured : DEFAULT_COOLDOWN_MINUTES;
  return minutes * 60 * 1000;
}

/**
 * Validated production site URL generator. Rejects unexpected URL schemes and prevents open redirects.
 */
export function getValidatedSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const trimmed = raw.trim().replace(/\/$/, "");
  try {
    const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.origin;
    }
  } catch {
    // Fallback
  }
  return "https://ganganathan.vercel.app";
}

function getSanitizedFromEmail(): string {
  const raw = process.env.RESEND_FROM_EMAIL || "Ganganathan Portfolio <onboarding@resend.dev>";
  // Strip extraneous surrounding quotes from .env parsing
  return raw.replace(/^["']|["']$/g, "").trim();
}

/**
 * Dispatch an email via Resend with categorized error detection and correlation ID
 */
export async function sendEmailViaResend({
  to,
  subject,
  html,
  attachments,
  correlationId = crypto.randomUUID(),
  eventType = "owner_new_message",
}: {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: string }>;
  correlationId?: string;
  eventType?: "owner_new_message" | "visitor_owner_reply" | "visitor_otp" | "archive_pdf";
}): Promise<{
  success: boolean;
  errorCategory?: NotificationLogEvent["providerErrorCategory"];
  messageId?: string;
  errorMessage?: string;
}> {
  const apiKey = (process.env.RESEND_API_KEY || "").replace(/^["']|["']$/g, "").trim();
  const recipientDomain = getRecipientDomain(to);

  // Missing or placeholder API key
  if (!apiKey || apiKey === "" || apiKey.includes("your-resend-api-key")) {
    if (process.env.NODE_ENV === "production") {
      logNotificationStructured({
        correlationId,
        eventType,
        status: "failed",
        recipientDomain,
        providerErrorCategory: "missing_key",
        timestamp: new Date().toISOString(),
      });
      console.warn(
        `[Notification Engine] RESEND_API_KEY is not configured in production environment. Email cannot be dispatched.`,
      );
      return {
        success: false,
        errorCategory: "missing_key",
        errorMessage: "RESEND_API_KEY is not configured.",
      };
    }

    // In dev / test mode without key, simulate dispatch
    logNotificationStructured({
      correlationId,
      eventType,
      status: "simulated",
      recipientDomain,
      timestamp: new Date().toISOString(),
    });
    return { success: true };
  }

  // RFC 2606 reserved testing domains (e.g. example.com, example.org, test) for non-routable QA / test automation
  const isReservedTestDomain =
    recipientDomain === "example.com" ||
    recipientDomain === "example.org" ||
    recipientDomain === "example.net" ||
    recipientDomain === "test" ||
    recipientDomain.endsWith(".example.com");

  if (isReservedTestDomain) {
    logNotificationStructured({
      correlationId,
      eventType,
      status: "simulated",
      recipientDomain,
      timestamp: new Date().toISOString(),
    });
    return { success: true, messageId: `sim_${crypto.randomUUID()}` };
  }

  const fromEmail = getSanitizedFromEmail();

  try {
    const emailPayload: Record<string, unknown> = {
      from: fromEmail,
      to: [to],
      subject,
      html,
    };

    if (Array.isArray(attachments) && attachments.length > 0) {
      emailPayload.attachments = attachments;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
      signal: AbortSignal.timeout(12000), // 12 second fail-safe timeout
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      let errorCategory: NotificationLogEvent["providerErrorCategory"] = "unknown";
      const errMsg = (data?.message || "").toLowerCase();

      if (res.status === 401 || res.status === 403) {
        if (
          errMsg.includes("verify a domain") ||
          errMsg.includes("testing emails to your own email address")
        ) {
          errorCategory = "domain_verification_required";
        } else {
          errorCategory = "auth_error";
        }
      } else if (res.status === 429) {
        errorCategory = "rate_limit";
      } else if (res.status >= 500) {
        errorCategory = "provider_outage";
      }

      logNotificationStructured({
        correlationId,
        eventType,
        status: "failed",
        recipientDomain,
        providerErrorCategory: errorCategory,
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        errorCategory,
        errorMessage: data?.message || "Email provider dispatch failed.",
      };
    }

    logNotificationStructured({
      correlationId,
      eventType,
      status: "sent",
      recipientDomain,
      timestamp: new Date().toISOString(),
    });

    return { success: true, messageId: data?.id };
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    const category = isTimeout ? "provider_outage" : "unknown";

    logNotificationStructured({
      correlationId,
      eventType,
      status: "failed",
      recipientDomain,
      providerErrorCategory: category,
      timestamp: new Date().toISOString(),
    });

    return { success: false, errorCategory: category, errorMessage: "Network or timeout error" };
  }
}

/**
 * Send 6-digit OTP verification email to visitor
 */
export async function sendOtpVerificationEmail(
  to: string,
  otp: string,
): Promise<{ success: boolean; errorCategory?: string; messageId?: string; errorMessage?: string }> {
  const correlationId = crypto.randomUUID();
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; background: #050816; color: #f3f3f3; padding: 36px 32px; border-radius: 16px; border: 1px solid #27272a;">
      <div style="margin-bottom: 24px;">
        <span style="background: linear-gradient(135deg, #915eff, #22d3ee); color: #050816; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">Live Portfolio Chat</span>
      </div>
      <h2 style="font-size: 20px; font-weight: bold; margin: 0 0 12px; color: #ffffff;">Verify your email address</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #a1a1aa; margin: 0 0 24px;">
        Please enter this 6-digit verification code in the live chat widget to enable email notifications when Ganganathan replies to your message.
      </p>
      <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid #3f3f46; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
        <div style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 0.3em; color: #22d3ee; margin-left: 0.3em;">
          ${otp}
        </div>
      </div>
      <p style="font-size: 12px; color: #71717a; margin: 0 0 8px;">
        • Code expires in <strong>10 minutes</strong>.
      </p>
      <p style="font-size: 12px; color: #71717a; margin: 0 0 24px;">
        • Single-use only. Do not share this code with anyone.
      </p>
      <div style="border-top: 1px solid #27272a; padding-top: 20px; font-size: 11px; color: #52525b;">
        If you did not request this verification code, you can safely ignore this email.
      </div>
    </div>
  `;

  const res = await sendEmailViaResend({
    to,
    subject: `[Ganganathan Portfolio] Your verification code is ${otp}`,
    html,
    correlationId,
    eventType: "visitor_otp",
  });

  return res;
}

/**
 * Notify Portfolio Owner of a new visitor message
 * - Generates clickable admin inbox link opening the exact conversation:
 *   ${siteUrl}/admin/inbox/${conversation.id}
 * - Access strictly requires an authenticated admin session.
 * - Cooldown is strictly independent per conversation.
 */
export async function notifyOwnerOfNewMessage(
  conversation: Pick<
    Conversation,
    "id" | "visitorName" | "visitorEmail" | "emailVerified" | "lastOwnerNotificationAt"
  >,
  messageContent: string,
): Promise<{ status: "sent" | "throttled" | "failed"; errorCategory?: string; errorMessage?: string }> {
  const ownerEmail = (process.env.OWNER_EMAIL || "green11.dev@gmail.com")
    .replace(/^["']|["']$/g, "")
    .trim();
  const cooldownMs = getCooldownMs();
  const preview = messageContent.slice(0, 160);
  const correlationId = crypto.randomUUID();
  const previousNotificationAt = (conversation as Conversation).lastOwnerNotificationAt || null;

  // 1. ATOMIC LOCK CLAIM
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

  // 2. Lock claimed: generate safe admin direct conversation link (/admin/inbox/<conversationId>)
  const siteUrl = getValidatedSiteUrl();
  const inboxLink = `${siteUrl}/admin/inbox/${encodeURIComponent(conversation.id)}`;
  const visitorDisplay = conversation.visitorName || "A visitor";
  const verifiedBadge = conversation.emailVerified
    ? `<span style="background: #14532d; color: #86efac; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: bold; margin-left: 6px;">Verified Email</span>`
    : "";

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; background: #0a0a0c; color: #f3f3f3; padding: 32px; border-radius: 16px; border: 1px solid #27272a;">
      <div style="margin-bottom: 24px;">
        <span style="background: #915eff; color: white; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">Live Portfolio Chat</span>
      </div>
      <h2 style="font-size: 20px; font-weight: bold; margin: 0 0 16px; color: #ffffff;">New message from ${visitorDisplay}</h2>
      <div style="background: rgba(255, 255, 255, 0.05); padding: 16px; border-radius: 12px; border-left: 3px solid #915eff; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 15px; line-height: 1.5; color: #e4e4e7;">"${preview}${messageContent.length > 160 ? "..." : ""}"</p>
      </div>
      ${conversation.visitorEmail ? `<p style="font-size: 13px; color: #a1a1aa; margin-bottom: 20px;">Visitor Email: <strong>${conversation.visitorEmail}</strong> ${verifiedBadge}</p>` : "<p style='font-size: 13px; color: #71717a; margin-bottom: 20px;'>Anonymous Guest (No email provided)</p>"}
      <div style="margin-top: 24px;">
        <a href="${inboxLink}" style="display: inline-block; background: #915eff; color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 14px;">Open Conversation in Admin Inbox →</a>
      </div>
      <p style="font-size: 11px; color: #71717a; margin-top: 32px; border-top: 1px solid #27272a; padding-top: 16px;">
        Notification throttled to once per ${Math.round(cooldownMs / 60000)} minutes per conversation. Sign-in required to view conversation.
      </p>
    </div>
  `;

  const dispatchResult = await sendEmailViaResend({
    to: ownerEmail,
    subject: `[Live Chat] New message from ${visitorDisplay}`,
    html,
    correlationId,
    eventType: "owner_new_message",
  });

  if (!dispatchResult.success) {
    // Release the atomic lock so future visitor messages are not blocked by a failed attempt!
    await releaseNotificationLock(conversation.id, "owner", previousNotificationAt);
  }

  const finalStatus = dispatchResult.success ? "sent" : "failed";
  await logNotification({
    conversationId: conversation.id,
    recipientType: "owner",
    recipientEmail: ownerEmail,
    status: finalStatus,
    messagePreview: preview,
  });

  return {
    status: finalStatus,
    errorCategory: dispatchResult.errorCategory,
    errorMessage: dispatchResult.errorMessage,
  };
}

/**
 * Notify Visitor of an Owner reply
 * - Strictly uses public visitor URL (e.g. ${siteUrl}/?live_chat=open), NEVER exposes /admin/inbox or admin secrets.
 * - Requires verified email and explicit notification consent.
 * - Unverified or anonymous visitors return { status: "skipped" }.
 */
export async function notifyVisitorOfOwnerReply(
  conversation: Pick<
    Conversation,
    "id" | "visitorName" | "visitorEmail" | "emailNotificationsEnabled" | "emailVerified" | "lastVisitorNotificationAt"
  >,
  replyContent: string,
): Promise<{ status: "sent" | "throttled" | "failed" | "skipped"; errorCategory?: string; errorMessage?: string }> {
  if (
    !conversation.visitorEmail ||
    !conversation.emailNotificationsEnabled ||
    !conversation.emailVerified
  ) {
    return { status: "skipped" };
  }

  const cooldownMs = getCooldownMs();
  const preview = replyContent.slice(0, 160);
  const correlationId = crypto.randomUUID();
  const previousNotificationAt = (conversation as Conversation).lastVisitorNotificationAt || null;

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

  // 2. Lock claimed: generate strictly PUBLIC visitor chat link
  const siteUrl = getValidatedSiteUrl();
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
        You received this because you verified your email on Ganganathan's portfolio.
      </p>
    </div>
  `;

  const dispatchResult = await sendEmailViaResend({
    to: conversation.visitorEmail,
    subject: `Ganganathan replied to your message`,
    html,
    correlationId,
    eventType: "visitor_owner_reply",
  });

  if (!dispatchResult.success) {
    await releaseNotificationLock(conversation.id, "visitor", previousNotificationAt);
  }

  const finalStatus = dispatchResult.success ? "sent" : "failed";
  await logNotification({
    conversationId: conversation.id,
    recipientType: "visitor",
    recipientEmail: conversation.visitorEmail,
    status: finalStatus,
    messagePreview: preview,
  });

  return {
    status: finalStatus,
    errorCategory: dispatchResult.errorCategory,
    errorMessage: dispatchResult.errorMessage,
  };
}
