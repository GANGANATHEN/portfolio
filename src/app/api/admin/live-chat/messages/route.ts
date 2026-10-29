import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  verifyAdminSessionToken,
  sanitizeText,
} from "@/lib/live-chat/security";
import {
  getMessages,
  markMessagesAsRead,
  editMessage,
  deleteMessage,
  getConversationById,
  DatabaseUnavailableError,
} from "@/lib/live-chat/db";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (!verifyAdminSessionToken(token)) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const conversationId = req.nextUrl.searchParams.get("conversationId");
    if (!conversationId) {
      return NextResponse.json({ error: "Missing conversationId parameter." }, { status: 400 });
    }

    const conversation = await getConversationById(conversationId);
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "100", 10);
    const before = req.nextUrl.searchParams.get("before") || undefined;

    const messages = await getMessages(conversationId, {
      limit: isNaN(limit) ? 100 : limit,
      before,
    });

    if (conversation.unreadOwnerCount > 0) {
      try {
        await markMessagesAsRead(conversationId, "owner");
      } catch (readErr) {
        console.warn("[Admin Inbox] markMessagesAsRead warning:", readErr);
      }
    }

    return NextResponse.json({
      messages,
      conversation,
    });
  } catch (error) {
    console.error("[Admin Messages GET Error]:", error);
    const isDbUnavailable =
      error instanceof DatabaseUnavailableError ||
      (error instanceof Error && error.message.includes("Production Database Error"));

    return NextResponse.json(
      {
        error: "Failed to load conversation messages.",
        code: isDbUnavailable ? "DATABASE_UNAVAILABLE" : "INTERNAL_ERROR",
      },
      { status: isDbUnavailable ? 503 : 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (!verifyAdminSessionToken(token)) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (
      !body ||
      typeof body.messageId !== "string" ||
      typeof body.conversationId !== "string" ||
      typeof body.content !== "string"
    ) {
      return NextResponse.json({ error: "Invalid edit payload." }, { status: 400 });
    }

    const sanitized = sanitizeText(body.content);
    if (!sanitized) {
      return NextResponse.json({ error: "Message cannot be empty." }, { status: 400 });
    }

    const updated = await editMessage(body.messageId, sanitized, "owner", body.conversationId);
    if (!updated) {
      return NextResponse.json(
        { error: "Message cannot be edited or not found." },
        { status: 403 },
      );
    }

    return NextResponse.json({ success: true, message: updated });
  } catch (error) {
    console.error("[Admin Messages PATCH Error]:", error);
    return NextResponse.json(
      { error: "Failed to edit message.", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (!verifyAdminSessionToken(token)) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const messageId = body?.messageId || req.nextUrl.searchParams.get("messageId");
    const conversationId = body?.conversationId || req.nextUrl.searchParams.get("conversationId");

    if (!messageId || !conversationId) {
      return NextResponse.json(
        { error: "Missing messageId or conversationId parameter." },
        { status: 400 },
      );
    }

    const deleted = await deleteMessage(messageId, "owner", conversationId);
    if (!deleted) {
      return NextResponse.json(
        { error: "Message not found or not authorized to delete." },
        { status: 403 },
      );
    }

    return NextResponse.json({ success: true, messageId });
  } catch (error) {
    console.error("[Admin Messages DELETE Error]:", error);
    return NextResponse.json(
      { error: "Failed to delete message.", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
