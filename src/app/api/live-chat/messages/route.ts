import { NextRequest, NextResponse } from "next/server";
import { VISITOR_COOKIE_NAME, hashToken } from "@/lib/live-chat/security";
import {
  getConversationByHash,
  getMessages,
  markMessagesAsRead,
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

  // Mark owner messages as read by this visitor
  const markRead = req.nextUrl.searchParams.get("mark_read") === "true";
  if (markRead && conversation.unreadVisitorCount > 0) {
    await markMessagesAsRead(conversation.id, "visitor");
  }

  const messages = await getMessages(conversation.id);

  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      senderType: m.senderType,
      content: m.content,
      createdAt: m.createdAt,
      readAt: m.readAt,
    })),
    unreadVisitorCount: markRead ? 0 : conversation.unreadVisitorCount,
  });
}
