import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/live-chat/security";
import { toggleMessageReaction, getConversationById } from "@/lib/live-chat/db";

const ALLOWED_EMOJIS = new Set(["👍", "❤️", "🔥", "🎉", "🚀", "👀"]);

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!verifyAdminSessionToken(token)) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body.messageId !== "string" ||
    typeof body.conversationId !== "string" ||
    typeof body.emoji !== "string"
  ) {
    return NextResponse.json({ error: "Invalid reaction payload." }, { status: 400 });
  }

  const conversation = await getConversationById(body.conversationId);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const emoji = body.emoji.trim();
  if (!ALLOWED_EMOJIS.has(emoji)) {
    return NextResponse.json(
      { error: "Invalid emoji. Allowed: 👍, ❤️, 🔥, 🎉, 🚀, 👀" },
      { status: 400 },
    );
  }

  const reactions = await toggleMessageReaction(body.messageId, emoji, "owner", body.conversationId);
  return NextResponse.json({ success: true, reactions });
}

