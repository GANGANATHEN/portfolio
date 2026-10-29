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
  getAttachmentById,
} from "@/lib/live-chat/db";
import { notifyVisitorOfOwnerReply } from "@/lib/live-chat/email";
import type { ChatAttachment } from "@/lib/live-chat/types";

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
    const hasAttachments = Array.isArray(body.attachmentIds) && body.attachmentIds.length > 0;

    if (!sanitized && !hasAttachments) {
      return NextResponse.json({ error: "Reply content cannot be empty." }, { status: 400 });
    }

    const conversation = await getConversationById(body.conversationId);
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    // Validate and link attachments
    const attachments: ChatAttachment[] = [];
    if (hasAttachments) {
      for (const id of body.attachmentIds) {
        if (typeof id === "string") {
          const att = await getAttachmentById(id);
          if (att && att.conversationId === conversation.id) {
            attachments.push(att);
          }
        }
      }
    }

    const replyToId = typeof body.replyToId === "string" ? body.replyToId : null;
    const clientMessageId = typeof body.clientMessageId === "string" ? body.clientMessageId : null;

    const message = await addMessage({
      conversationId: conversation.id,
      senderType: "owner",
      content: sanitized || (attachments.length > 0 ? `[Attached ${attachments[0].fileName}]` : ""),
      replyToId,
      attachments,
      clientMessageId,
    });

    await markMessagesAsRead(conversation.id, "owner");

    // Await email delivery to prevent serverless execution cutoff
    try {
      await notifyVisitorOfOwnerReply(conversation, message.content);
    } catch (err) {
      console.error("[Visitor Notification Exception]:", err);
    }

    return NextResponse.json({
      success: true,
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
  } catch (error) {
    console.error("[Admin Reply Error]:", error);
    return NextResponse.json({ error: "Failed to send reply." }, { status: 500 });
  }
}
