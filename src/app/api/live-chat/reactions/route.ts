import { NextRequest, NextResponse } from "next/server";
import { VISITOR_COOKIE_NAME } from "@/lib/live-chat/security";
import { toggleMessageReaction, DatabaseUnavailableError } from "@/lib/live-chat/db";
import {
  validateVisitorSession,
  createSessionRejectedResponse,
} from "@/lib/live-chat/session-registry";

const CURATED_EMOJIS = new Set([
  "👍", "❤️", "🔥", "🎉", "😂", "😮", "😢", "🙏", "🚀", "👀",
  "👏", "💯", "✨", "💡", "🎯", "🤝", "🤩", "🥳", "🤔", "😎",
]);

function isValidEmoji(str: string): boolean {
  if (!str) return false;
  const trimmed = str.trim();
  if (CURATED_EMOJIS.has(trimmed)) return true;
  if (trimmed.length > 8) return false;
  return /^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\uFE0F|\u200D)+$/u.test(trimmed);
}

export async function POST(req: NextRequest) {
  try {
    const auth = await validateVisitorSession(req);
    if (!auth.valid) {
      if (auth.clearCookie) {
        return createSessionRejectedResponse(auth, VISITOR_COOKIE_NAME);
      }
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    const conversation = auth.conversation;
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body.messageId !== "string" || typeof body.emoji !== "string") {
      return NextResponse.json({ error: "Invalid reaction payload." }, { status: 400 });
    }

    const emoji = body.emoji.trim();
    if (!isValidEmoji(emoji)) {
      return NextResponse.json(
        { error: "Invalid emoji character." },
        { status: 400 },
      );
    }

    const reactions = await toggleMessageReaction(body.messageId, emoji, "visitor", conversation.id);
    return NextResponse.json({ success: true, reactions });
  } catch (error) {
    console.error("[Live Chat Reactions Error]:", error);
    const isDbUnavailable =
      error instanceof DatabaseUnavailableError ||
      (error instanceof Error && error.message.includes("Production Database Error"));

    return NextResponse.json(
      {
        error: "Failed to update reaction.",
        code: isDbUnavailable ? "DATABASE_UNAVAILABLE" : "INTERNAL_ERROR",
      },
      { status: isDbUnavailable ? 503 : 500 },
    );
  }
}
