import { NextRequest, NextResponse } from "next/server";
import { VISITOR_COOKIE_NAME, hashToken } from "@/lib/live-chat/security";
import { validateVisitorSession } from "@/lib/live-chat/session-registry";
import { revokeActiveSessionRecord } from "@/lib/live-chat/db";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(VISITOR_COOKIE_NAME)?.value;
    const authVisitor = await validateVisitorSession(req);

    if (authVisitor.conversation?.visitorEmail) {
      const email = authVisitor.conversation.visitorEmail;
      const tokenHash = token ? hashToken(token) : undefined;
      await revokeActiveSessionRecord("visitor", email, tokenHash);
    } else if (token) {
      const tokenHash = hashToken(token);
      await revokeActiveSessionRecord("visitor", tokenHash, tokenHash);
    }

    const response = NextResponse.json({ success: true, message: "Logged out successfully." });

    response.cookies.set({
      name: VISITOR_COOKIE_NAME,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[Visitor Logout Error]:", error);
    return NextResponse.json({ error: "Failed to log out." }, { status: 500 });
  }
}

