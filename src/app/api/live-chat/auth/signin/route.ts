import { NextRequest, NextResponse } from "next/server";
import {
  isValidEmail,
  verifyPassword,
  generateSecureToken,
  hashToken,
  VISITOR_COOKIE_NAME,
} from "@/lib/live-chat/security";
import {
  getVisitorAccountByEmail,
  getOrCreateConversationByHash,
  associateConversationWithVerifiedEmail,
} from "@/lib/live-chat/db";
import { registerVisitorActiveSession } from "@/lib/live-chat/session-registry";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const { email, password } = body;
    if (!email || typeof email !== "string" || !password || typeof password !== "string") {
      return NextResponse.json({ error: "Please enter your email and password." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const account = await getVisitorAccountByEmail(normalizedEmail);
    if (!account || account.isDeleted) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const isValid = verifyPassword(password, account.passwordHash, account.passwordSalt);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    // Single Active Session Security:
    // Generate new token and register as active session.
    // This atomically supersedes any previous active session for this account!
    const visitorToken = generateSecureToken();
    const tokenHash = hashToken(visitorToken);

    const initialConv = await getOrCreateConversationByHash(tokenHash, account.name || "Visitor");
    const { conversation: conv } = await associateConversationWithVerifiedEmail(
      initialConv.id,
      tokenHash,
      normalizedEmail,
    );

    await registerVisitorActiveSession(normalizedEmail, visitorToken, conv.id, req);

    const response = NextResponse.json({
      success: true,
      account: {
        id: account.id,
        email: account.email,
        name: account.name,
        emailVerified: account.emailVerified,
      },
      conversationId: conv.id,
    });

    response.cookies.set({
      name: VISITOR_COOKIE_NAME,
      value: visitorToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[Visitor SignIn Error]:", error);
    return NextResponse.json({ error: "Failed to sign in. Please try again." }, { status: 500 });
  }
}
