import { NextRequest, NextResponse } from "next/server";
import {
  isValidEmail,
  isStrongPassword,
  hashPassword,
  generateSecureToken,
  hashToken,
  VISITOR_COOKIE_NAME,
} from "@/lib/live-chat/security";
import {
  getVisitorAccountByEmail,
  createVisitorAccount,
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

    const { email, password, name } = body;
    if (!email || typeof email !== "string" || !isValidEmail(email)) {
      return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
    }

    const passValidation = isStrongPassword(password);
    if (!passValidation.valid) {
      return NextResponse.json({ error: passValidation.message }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await getVisitorAccountByEmail(normalizedEmail);
    if (existing && !existing.isDeleted) {
      return NextResponse.json(
        { error: "An account with this email address already exists. Please sign in." },
        { status: 409 },
      );
    }

    const { hash, salt } = hashPassword(password);
    const account = await createVisitorAccount({
      email: normalizedEmail,
      passwordHash: hash,
      passwordSalt: salt,
      name: typeof name === "string" ? name.trim() : null,
      emailVerified: true,
    });

    // Establish Single Active Session for this account
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
    console.error("[Visitor SignUp Error]:", error);
    return NextResponse.json({ error: "Failed to create account. Please try again." }, { status: 500 });
  }
}
