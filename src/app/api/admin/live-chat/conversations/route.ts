import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/live-chat/security";
import {
  getAllConversationsForAdmin,
  deleteConversationByAdmin,
  archiveConversationByAdmin,
} from "@/lib/live-chat/db";

export async function GET(req: NextRequest) {
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
    })),
  });
}

export async function DELETE(req: NextRequest) {
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

  const deleted = await deleteConversationByAdmin(conversationId);
  if (!deleted) {
    return NextResponse.json(
      { error: "Failed to delete conversation or not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, conversationId });
}

export async function PATCH(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!verifyAdminSessionToken(token)) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.conversationId !== "string" || typeof body.isArchived !== "boolean") {
    return NextResponse.json({ error: "Invalid archive payload." }, { status: 400 });
  }

  const success = await archiveConversationByAdmin(body.conversationId, body.isArchived);
  return NextResponse.json({ success, conversationId: body.conversationId });
}
