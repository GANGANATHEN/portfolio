import { NextRequest, NextResponse } from "next/server";
import {
  VISITOR_COOKIE_NAME,
  generateSecureToken,
  hashToken,
} from "@/lib/live-chat/security";
import {
  getOrCreateConversationByHash,
  DatabaseUnavailableError,
} from "@/lib/live-chat/db";

export async function GET(req: NextRequest) {
  try {
    let token = req.cookies.get(VISITOR_COOKIE_NAME)?.value;
    let isNewSession = false;

    // Session token must strictly be 64-char hex (32 bytes)
    if (!token || token.length < 32 || !/^[0-9a-fA-F]+$/.test(token)) {
      token = generateSecureToken();
      isNewSession = true;
    }

    const tokenHash = hashToken(token);
    const conversation = await getOrCreateConversationByHash(tokenHash);

    const res = NextResponse.json({
      conversationId: conversation.id,
      visitorName: conversation.visitorName,
      visitorEmail: conversation.visitorEmail,
      emailVerified: conversation.emailVerified,
      emailNotificationsEnabled: conversation.emailNotificationsEnabled,
      unreadVisitorCount: conversation.unreadVisitorCount,
    });

    if (isNewSession) {
      res.cookies.set({
        name: VISITOR_COOKIE_NAME,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365, // 1 year persistent visitor session
        path: "/",
      });
    }

    return res;
  } catch (error) {
    console.error("[Live Chat Session API Error]:", error);
    const isDbUnavailable =
      error instanceof DatabaseUnavailableError ||
      (error instanceof Error &&
        (error.message.includes("Production Database Error") ||
          error.message.includes("schema cache") ||
          error.message.includes("chat_conversations")));

    return NextResponse.json(
      {
        error: isDbUnavailable
          ? "Live chat service is temporarily unavailable. Please try again shortly."
          : "An unexpected error occurred while initializing session.",
        code: isDbUnavailable ? "DATABASE_UNAVAILABLE" : "INTERNAL_ERROR",
      },
      { status: isDbUnavailable ? 503 : 500 },
    );
  }
}
