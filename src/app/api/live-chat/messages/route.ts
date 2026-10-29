import { NextRequest, NextResponse } from "next/server";
import { VISITOR_COOKIE_NAME, hashToken, sanitizeText } from "@/lib/live-chat/security";
import {
  getConversationByHash,
  getMessages,
  markMessagesAsRead,
  editMessage,
  deleteMessage,
  DatabaseUnavailableError,
} from "@/lib/live-chat/db";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(VISITOR_COOKIE_NAME)?.value;
    if (!token || token.length < 32) {
      return NextResponse.json({ messages: [], unreadVisitorCount: 0 });
    }

    const tokenHash = hashToken(token);
    const conversation = await getConversationByHash(tokenHash);
    if (!conversation) {
      return NextResponse.json({ messages: [], unreadVisitorCount: 0 });
    }

    // Mark owner messages as read by this visitor if requested
    const markRead = req.nextUrl.searchParams.get("mark_read") === "true";
    if (markRead && conversation.unreadVisitorCount > 0) {
      try {
        await markMessagesAsRead(conversation.id, "visitor");
      } catch (readErr) {
        console.warn("[Live Chat] Non-fatal markMessagesAsRead warning:", readErr);
      }
    }

    const limitParam = parseInt(req.nextUrl.searchParams.get("limit") || "100", 10);
    const beforeParam = req.nextUrl.searchParams.get("before") || undefined;

    const messages = await getMessages(conversation.id, {
      limit: isNaN(limitParam) ? 100 : limitParam,
      before: beforeParam,
    });

    return NextResponse.json({
      messages,
      unreadVisitorCount: markRead ? 0 : conversation.unreadVisitorCount,
    });
  } catch (error) {
    console.error("[Live Chat Messages API Error]:", error);
    const isDbUnavailable =
      error instanceof DatabaseUnavailableError ||
      (error instanceof Error &&
        (error.message.includes("Production Database Error") ||
          error.message.includes("schema cache") ||
          error.message.includes("chat_conversations")));

    return NextResponse.json(
      {
        error: isDbUnavailable
          ? "Live chat service is temporarily unavailable. Please try again shortly."
          : "An unexpected error occurred while loading messages.",
        code: isDbUnavailable ? "DATABASE_UNAVAILABLE" : "INTERNAL_ERROR",
      },
      { status: isDbUnavailable ? 503 : 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get(VISITOR_COOKIE_NAME)?.value;
    if (!token || token.length < 32) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    const tokenHash = hashToken(token);
    const conversation = await getConversationByHash(tokenHash);
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body.messageId !== "string" || typeof body.content !== "string") {
      return NextResponse.json({ error: "Invalid edit payload." }, { status: 400 });
    }

    const sanitized = sanitizeText(body.content);
    if (!sanitized) {
      return NextResponse.json({ error: "Message cannot be empty." }, { status: 400 });
    }

    const updated = await editMessage(body.messageId, sanitized, "visitor", conversation.id);
    if (!updated) {
      return NextResponse.json(
        { error: "Message cannot be edited or not found." },
        { status: 403 },
      );
    }

    return NextResponse.json({ success: true, message: updated });
  } catch (error) {
    console.error("[Live Chat Edit Error]:", error);
    const isDbUnavailable =
      error instanceof DatabaseUnavailableError ||
      (error instanceof Error && error.message.includes("Production Database Error"));

    return NextResponse.json(
      {
        error: "Failed to update message.",
        code: isDbUnavailable ? "DATABASE_UNAVAILABLE" : "INTERNAL_ERROR",
      },
      { status: isDbUnavailable ? 503 : 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get(VISITOR_COOKIE_NAME)?.value;
    if (!token || token.length < 32) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    const tokenHash = hashToken(token);
    const conversation = await getConversationByHash(tokenHash);
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const messageId = body?.messageId || req.nextUrl.searchParams.get("messageId");
    if (!messageId || typeof messageId !== "string") {
      return NextResponse.json({ error: "Missing messageId parameter." }, { status: 400 });
    }

    const deleted = await deleteMessage(messageId, "visitor", conversation.id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Message not found or not authorized to delete." },
        { status: 403 },
      );
    }

    return NextResponse.json({ success: true, messageId });
  } catch (error) {
    console.error("[Live Chat Delete Error]:", error);
    const isDbUnavailable =
      error instanceof DatabaseUnavailableError ||
      (error instanceof Error && error.message.includes("Production Database Error"));

    return NextResponse.json(
      {
        error: "Failed to delete message.",
        code: isDbUnavailable ? "DATABASE_UNAVAILABLE" : "INTERNAL_ERROR",
      },
      { status: isDbUnavailable ? 503 : 500 },
    );
  }
}
