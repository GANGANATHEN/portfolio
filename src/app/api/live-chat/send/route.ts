import { NextRequest, NextResponse } from "next/server";
import {
  VISITOR_COOKIE_NAME,
  generateSecureToken,
  hashToken,
  sanitizeText,
} from "@/lib/live-chat/security";
import {
  getOrCreateConversationByHash,
  addMessage,
  getAttachmentById,
} from "@/lib/live-chat/db";
import { notifyOwnerOfNewMessage } from "@/lib/live-chat/email";
import type { ChatAttachment } from "@/lib/live-chat/types";

// In-memory rate limiter for live chat messaging
const visitorRateLimits = new Map<string, { count: number; resetAt: number }>();

function checkVisitorRateLimit(tokenHash: string): boolean {
  const now = Date.now();
  const record = visitorRateLimits.get(tokenHash);

  if (!record || record.resetAt < now) {
    visitorRateLimits.set(tokenHash, { count: 1, resetAt: now + 120000 }); // 2 minute window
    return false;
  }

  if (record.count >= 20) {
    return true; // Limit exceeded
  }

  record.count += 1;
  return false;
}

export async function POST(req: NextRequest) {
  try {
    let token = req.cookies.get(VISITOR_COOKIE_NAME)?.value;
    let isNewSession = false;

    if (!token || token.length < 32) {
      token = generateSecureToken();
      isNewSession = true;
    }

    const tokenHash = hashToken(token);

    if (checkVisitorRateLimit(tokenHash)) {
      return NextResponse.json(
        { error: "You are sending messages too quickly. Please wait a moment." },
        { status: 429 },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body.content !== "string") {
      return NextResponse.json({ error: "Invalid message payload." }, { status: 400 });
    }

    const sanitized = sanitizeText(body.content);
    const hasAttachments = Array.isArray(body.attachmentIds) && body.attachmentIds.length > 0;

    if (!sanitized && !hasAttachments) {
      return NextResponse.json({ error: "Message cannot be empty." }, { status: 400 });
    }

    if (sanitized.length > 2000) {
      return NextResponse.json(
        { error: "Message exceeds 2,000 character limit." },
        { status: 400 },
      );
    }

    const conversation = await getOrCreateConversationByHash(tokenHash);

    // Validate and link attachments
    const attachments: ChatAttachment[] = [];
    if (hasAttachments) {
      for (const id of body.attachmentIds) {
        if (typeof id === "string") {
          const att = await getAttachmentById(id);
          // Only link attachments belonging to this conversation
          if (att && att.conversationId === conversation.id) {
            attachments.push(att);
          }
        }
      }
    }

    const replyToId = typeof body.replyToId === "string" ? body.replyToId : null;
    const clientMessageId = typeof body.clientMessageId === "string" ? body.clientMessageId : null;

    // Persist message first (guarantees message persistence regardless of email delivery)
    const message = await addMessage({
      conversationId: conversation.id,
      senderType: "visitor",
      content: sanitized || (attachments.length > 0 ? `[Attached ${attachments[0].fileName}]` : ""),
      replyToId,
      attachments,
      clientMessageId,
    });

    // Safely await email notification to prevent serverless execution freeze
    try {
      await notifyOwnerOfNewMessage(conversation, message.content);
    } catch (err) {
      console.error("[Owner Notification Exception]:", err);
    }

    const res = NextResponse.json({
      message: {
        id: message.id,
        senderType: message.senderType,
        content: message.content,
        createdAt: message.createdAt,
        replyToId: message.replyToId,
        replyPreview: message.replyPreview,
        reactions: message.reactions,
        attachments: message.attachments,
        clientMessageId: message.clientMessageId,
      },
    });

    if (isNewSession) {
      res.cookies.set({
        name: VISITOR_COOKIE_NAME,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
      });
    }

    return res;
  } catch (error) {
    console.error("[Live Chat Send Error]:", error);
    const isDbUnavailable =
      error instanceof Error &&
      (error.message.includes("Production Database Error") ||
        error.message.includes("schema cache") ||
        error.message.includes("chat_conversations"));

    return NextResponse.json(
      {
        error: isDbUnavailable
          ? "Live chat service is temporarily unavailable. Please try again shortly."
          : "Failed to send message. Please retry.",
        code: isDbUnavailable ? "DATABASE_UNAVAILABLE" : "INTERNAL_ERROR",
      },
      { status: isDbUnavailable ? 503 : 500 },
    );
  }
}
