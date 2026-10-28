import { NextRequest, NextResponse } from "next/server";
import {
  VISITOR_COOKIE_NAME,
  generateSecureToken,
  hashToken,
} from "@/lib/live-chat/security";
import { getOrCreateConversationByHash } from "@/lib/live-chat/db";

export async function GET(req: NextRequest) {
  let token = req.cookies.get(VISITOR_COOKIE_NAME)?.value;
  let isNewSession = false;

  // Support session token from query string (e.g. from notification email)
  const queryToken = req.nextUrl.searchParams.get("token");
  if (queryToken && queryToken.length === 64) {
    token = queryToken;
    isNewSession = true;
  }

  if (!token || token.length < 32) {
    token = generateSecureToken();
    isNewSession = true;
  }

  const tokenHash = hashToken(token);
  const conversation = await getOrCreateConversationByHash(tokenHash);

  const res = NextResponse.json({
    visitorName: conversation.visitorName,
    visitorEmail: conversation.visitorEmail,
    emailNotificationsEnabled: conversation.emailNotificationsEnabled,
    unreadVisitorCount: conversation.unreadVisitorCount,
    conversationId: conversation.id,
  });

  if (isNewSession) {
    res.cookies.set({
      name: VISITOR_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    });
  }

  return res;
}
