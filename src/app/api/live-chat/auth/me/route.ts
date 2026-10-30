import { NextRequest, NextResponse } from "next/server";
import { VISITOR_COOKIE_NAME } from "@/lib/live-chat/security";
import { validateVisitorSession, createSessionRejectedResponse } from "@/lib/live-chat/session-registry";
import { getVisitorAccountByEmail } from "@/lib/live-chat/db";

export async function GET(req: NextRequest) {
  try {
    const authVisitor = await validateVisitorSession(req);
    if (!authVisitor.valid) {
      if (authVisitor.clearCookie) {
        return createSessionRejectedResponse(authVisitor, VISITOR_COOKIE_NAME);
      }
      return NextResponse.json({ authenticated: false });
    }

    const email = authVisitor.conversation?.visitorEmail;
    let account = null;
    if (email) {
      const dbAccount = await getVisitorAccountByEmail(email);
      if (dbAccount && !dbAccount.isDeleted) {
        account = {
          id: dbAccount.id,
          email: dbAccount.email,
          name: dbAccount.name,
          emailVerified: dbAccount.emailVerified,
        };
      }
    }

    return NextResponse.json({
      authenticated: true,
      account,
      conversation: authVisitor.conversation
        ? {
            id: authVisitor.conversation.id,
            visitorName: authVisitor.conversation.visitorName,
            visitorEmail: authVisitor.conversation.visitorEmail,
            emailVerified: authVisitor.conversation.emailVerified,
          }
        : null,
    });
  } catch (error) {
    console.error("[Visitor Auth Me Error]:", error);
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}

