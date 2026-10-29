import { NextRequest, NextResponse } from "next/server";
import { VISITOR_COOKIE_NAME, hashToken, sanitizeText } from "@/lib/live-chat/security";
import {
  getConversationByHash,
  getMessages,
  markMessagesAsRead,
  editMessage,
  deleteMessage,
} from "@/lib/live-chat/db";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(VISITOR_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ messages: [] });
  }

  const tokenHash = hashToken(token);
  const conversation = await getConversationByHash(tokenHash);
  if (!conversation) {
    return NextResponse.json({ messages: [] });
  }

  // Mark owner messages as read by this visitor if requested
  const markRead = req.nextUrl.searchParams.get("mark_read") === "true";
  if (markRead && conversation.unreadVisitorCount > 0) {
    await markMessagesAsRead(conversation.id, "visitor");
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
}

export async function PATCH(req: NextRequest) {
  const token = req.cookies.get(VISITOR_COOKIE_NAME)?.value;
  if (!token) {
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
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get(VISITOR_COOKIE_NAME)?.value;
  if (!token) {
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
}
