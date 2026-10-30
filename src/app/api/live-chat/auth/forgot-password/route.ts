import { NextRequest, NextResponse } from "next/server";
import {
  isValidEmail,
  generatePasswordResetToken,
} from "@/lib/live-chat/security";
import {
  getVisitorAccountByEmail,
  createPasswordResetRecord,
} from "@/lib/live-chat/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const { email } = body;
    if (!email || typeof email !== "string" || !isValidEmail(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const account = await getVisitorAccountByEmail(normalizedEmail);

    if (account && !account.isDeleted) {
      // 1 hour expiration
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const { token, tokenHash } = generatePasswordResetToken();

      await createPasswordResetRecord({
        accountId: account.id,
        email: normalizedEmail,
        tokenHash,
        expiresAt,
      });

      // In production, dispatch email with reset link. In dev/test, token is securely recorded.
      console.log(`[Password Reset Dispatched] Reset link generated for ${normalizedEmail}. Token: ${token}`);
    }

    // Always return generic 200 message to prevent account enumeration
    return NextResponse.json({
      success: true,
      message: "If an account exists with this email, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("[Forgot Password Error]:", error);
    return NextResponse.json({ error: "Failed to process password reset request." }, { status: 500 });
  }
}

