import { NextRequest, NextResponse } from "next/server";
import {
  VISITOR_COOKIE_NAME,
  verifyPassword,
} from "@/lib/live-chat/security";
import {
  validateVisitorSession,
  createSessionRejectedResponse,
} from "@/lib/live-chat/session-registry";
import {
  getVisitorAccountByEmail,
  deleteVisitorAccount,
  revokeActiveSessionRecord,
  deleteConversationByAdmin,
} from "@/lib/live-chat/db";

export async function POST(req: NextRequest) {
  try {
    const authVisitor = await validateVisitorSession(req);
    if (!authVisitor.valid) {
      if (authVisitor.clearCookie) {
        return createSessionRejectedResponse(authVisitor, VISITOR_COOKIE_NAME);
      }
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const email = authVisitor.conversation?.visitorEmail;
    if (!email) {
      return NextResponse.json({ error: "No registered visitor account found for this session." }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const password = body?.password;
    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Please provide your current password to confirm deletion." }, { status: 400 });
    }

    const account = await getVisitorAccountByEmail(email);
    if (!account || account.isDeleted) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    const isMatch = verifyPassword(password, account.passwordHash, account.passwordSalt);
    if (!isMatch) {
      return NextResponse.json({ error: "Incorrect password. Account deletion aborted." }, { status: 401 });
    }

    // 1. Soft-delete the account
    await deleteVisitorAccount(account.id);

    // 2. Revoke active session on all devices
    await revokeActiveSessionRecord("visitor", email);

    // 3. Delete conversation data
    if (authVisitor.conversation?.id) {
      await deleteConversationByAdmin(authVisitor.conversation.id);
    }

    const response = NextResponse.json({
      success: true,
      message: "Account and associated data have been permanently queued for removal.",
    });

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
    console.error("[Delete Account Error]:", error);
    return NextResponse.json({ error: "Failed to delete account. Please try again." }, { status: 500 });
  }
}
