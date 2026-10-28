import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/live-chat/security";
import { getAllConversationsForAdmin } from "@/lib/live-chat/db";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!verifyAdminSessionToken(token)) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }

  const conversations = await getAllConversationsForAdmin();

  return NextResponse.json({
    conversations: conversations.map((c) => ({
      id: c.id,
      visitorName: c.visitorName,
      visitorEmail: c.visitorEmail,
      emailNotificationsEnabled: c.emailNotificationsEnabled,
      createdAt: c.createdAt,
      lastMessageAt: c.lastMessageAt,
      unreadOwnerCount: c.unreadOwnerCount,
      latestMessage: c.latestMessage,
    })),
  });
}
