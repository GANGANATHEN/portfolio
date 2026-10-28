import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/live-chat/security";
import { getConversationById, getMessages, markMessagesAsRead } from "@/lib/live-chat/db";

export async function GET(req: NextRequest) {
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

  // Mark visitor messages as read by owner
  await markMessagesAsRead(conversationId, "owner");

  const messages = await getMessages(conversationId);

  return NextResponse.json({
    conversation: {
      id: conversation.id,
      visitorName: conversation.visitorName,
      visitorEmail: conversation.visitorEmail,
      emailNotificationsEnabled: conversation.emailNotificationsEnabled,
      createdAt: conversation.createdAt,
      lastMessageAt: conversation.lastMessageAt,
      unreadOwnerCount: 0,
    },
    messages: messages.map((m) => ({
      id: m.id,
      senderType: m.senderType,
      content: m.content,
      createdAt: m.createdAt,
      readAt: m.readAt,
    })),
  });
}
