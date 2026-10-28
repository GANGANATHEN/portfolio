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
} from "@/lib/live-chat/db";
import { notifyOwnerOfNewMessage } from "@/lib/live-chat/email";

// In-memory rate limiter for live chat
const visitorRateLimits = new Map<string, { count: number; resetAt: number }>();

function checkVisitorRateLimit(tokenHash: string): boolean {
  const now = Date.now();
  const record = visitorRateLimits.get(tokenHash);

  if (!record || record.resetAt < now) {
    visitorRateLimits.set(tokenHash, { count: 1, resetAt: now + 120000 }); // 2 minute window
    return false;
  }

  if (record.count >= 15) {
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
    if (!sanitized) {
      return NextResponse.json({ error: "Message cannot be empty." }, { status: 400 });
    }

    if (sanitized.length > 2000) {
      return NextResponse.json(
        { error: "Message exceeds 2,000 character limit." },
        { status: 400 },
      );
    }

    const conversation = await getOrCreateConversationByHash(tokenHash);

    const message = await addMessage({
      conversationId: conversation.id,
      senderType: "visitor",
      content: sanitized,
    });

    // Fire & wait for throttled email notification
    notifyOwnerOfNewMessage(conversation, sanitized).catch((err) =>
      console.error("[Owner Notification Error]:", err),
    );

    const res = NextResponse.json({
      message: {
        id: message.id,
        senderType: message.senderType,
        content: message.content,
        createdAt: message.createdAt,
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
    return NextResponse.json(
      { error: "Failed to send message. Please try again." },
      { status: 500 },
    );
  }
}
