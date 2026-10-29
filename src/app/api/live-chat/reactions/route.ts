import { NextRequest, NextResponse } from "next/server";
import { VISITOR_COOKIE_NAME, hashToken } from "@/lib/live-chat/security";
import { getConversationByHash, toggleMessageReaction } from "@/lib/live-chat/db";

const ALLOWED_EMOJIS = new Set(["👍", "❤️", "🔥", "🎉", "🚀", "👀"]);

export async function POST(req: NextRequest) {
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
  if (!body || typeof body.messageId !== "string" || typeof body.emoji !== "string") {
    return NextResponse.json({ error: "Invalid reaction payload." }, { status: 400 });
  }

  const emoji = body.emoji.trim();
  if (!ALLOWED_EMOJIS.has(emoji)) {
    return NextResponse.json(
      { error: "Invalid emoji. Allowed: 👍, ❤️, 🔥, 🎉, 🚀, 👀" },
      { status: 400 },
    );
  }

  const reactions = await toggleMessageReaction(body.messageId, emoji, "visitor", conversation.id);
  return NextResponse.json({ success: true, reactions });
}

