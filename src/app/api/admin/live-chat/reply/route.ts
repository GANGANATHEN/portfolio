import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  verifyAdminSessionToken,
  sanitizeText,
} from "@/lib/live-chat/security";
import {
  getConversationById,
  addMessage,
  markMessagesAsRead,
} from "@/lib/live-chat/db";
import { notifyVisitorOfOwnerReply } from "@/lib/live-chat/email";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (!verifyAdminSessionToken(token)) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || !body.conversationId || typeof body.content !== "string") {
      return NextResponse.json({ error: "Invalid reply payload." }, { status: 400 });
    }

    const sanitized = sanitizeText(body.content);
    if (!sanitized) {
      return NextResponse.json({ error: "Reply content cannot be empty." }, { status: 400 });
    }

    const conversation = await getConversationById(body.conversationId);
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    const message = await addMessage({
      conversationId: conversation.id,
      senderType: "owner",
      content: sanitized,
    });

    await markMessagesAsRead(conversation.id, "owner");

    // Send throttled email to visitor if email was provided and consented
    notifyVisitorOfOwnerReply(conversation, sanitized).catch((err) =>
      console.error("[Visitor Notification Error]:", err),
    );

    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        senderType: message.senderType,
        content: message.content,
        createdAt: message.createdAt,
      },
    });
  } catch (error) {
    console.error("[Admin Reply Error]:", error);
    return NextResponse.json({ error: "Failed to send reply." }, { status: 500 });
  }
}
