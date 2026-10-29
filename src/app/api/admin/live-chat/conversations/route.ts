import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/live-chat/security";
import {
  getAllConversationsForAdmin,
  deleteConversationByAdmin,
  archiveConversationByAdmin,
  pinConversationByAdmin,
  DatabaseUnavailableError,
} from "@/lib/live-chat/db";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (!verifyAdminSessionToken(token)) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const status = req.nextUrl.searchParams.get("status") as
      | "all"
      | "unread"
      | "read"
      | "awaiting_reply"
      | "archived"
      | null;
    const search = req.nextUrl.searchParams.get("search") || undefined;

    const conversations = await getAllConversationsForAdmin({
      status: status || "all",
      search,
    });

    return NextResponse.json({
      conversations: conversations.map((c) => ({
        id: c.id,
        visitorName: c.visitorName,
        visitorEmail: c.visitorEmail,
        emailVerified: c.emailVerified ?? false,
        emailNotificationsEnabled: c.emailNotificationsEnabled,
        createdAt: c.createdAt,
        lastMessageAt: c.lastMessageAt,
        unreadOwnerCount: c.unreadOwnerCount,
        latestMessage: c.latestMessage,
        isArchived: Boolean(c.isArchived),
        isPinned: Boolean(c.isPinned),
      })),
    });
  } catch (error) {
    console.error("[Admin Conversations GET Error]:", error);
    const isDbUnavailable =
      error instanceof DatabaseUnavailableError ||
      (error instanceof Error && error.message.includes("Production Database Error"));

    return NextResponse.json(
      {
        error: "Failed to load conversations.",
        code: isDbUnavailable ? "DATABASE_UNAVAILABLE" : "INTERNAL_ERROR",
      },
      { status: isDbUnavailable ? 503 : 500 },
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
    const conversationId = body?.conversationId || req.nextUrl.searchParams.get("conversationId");

    if (!conversationId || typeof conversationId !== "string") {
      return NextResponse.json(
        { error: "Missing conversationId parameter." },
        { status: 400 },
      );
    }

    const success = await deleteConversationByAdmin(conversationId);
    if (!success) {
      return NextResponse.json(
        { error: "Conversation not found or could not be deleted." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, conversationId });
  } catch (error) {
    console.error("[Admin Conversations DELETE Error]:", error);
    return NextResponse.json(
      { error: "Failed to delete conversation.", code: "INTERNAL_ERROR" },
      { status: 500 },
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
    if (!body || typeof body.conversationId !== "string") {
      return NextResponse.json(
        { error: "Invalid request payload. 'conversationId' is required." },
        { status: 400 },
      );
    }

    // Support Pin / Unpin
    if (typeof body.pin === "boolean" || typeof body.isPinned === "boolean") {
      const pinState = typeof body.pin === "boolean" ? body.pin : Boolean(body.isPinned);
      const success = await pinConversationByAdmin(body.conversationId, pinState);
      if (!success) {
        return NextResponse.json(
          { error: "Conversation not found." },
          { status: 404 },
        );
      }
      return NextResponse.json({ success: true, isPinned: pinState });
    }

    // Support Archive / Unarchive
    if (typeof body.archive === "boolean" || typeof body.isArchived === "boolean") {
      const archiveState = typeof body.archive === "boolean" ? body.archive : Boolean(body.isArchived);
      const success = await archiveConversationByAdmin(body.conversationId, archiveState);
      if (!success) {
        return NextResponse.json(
          { error: "Conversation not found." },
          { status: 404 },
        );
      }
      return NextResponse.json({ success: true, isArchived: archiveState });
    }

    return NextResponse.json(
      { error: "Missing required 'pin' or 'archive' boolean parameter." },
      { status: 400 },
    );
  } catch (error) {
    console.error("[Admin Conversations PATCH Error]:", error);
    return NextResponse.json(
      { error: "Failed to update archive status.", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
