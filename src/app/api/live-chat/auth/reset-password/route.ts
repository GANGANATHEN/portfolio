import { NextRequest, NextResponse } from "next/server";
import {
  hashToken,
  isStrongPassword,
  hashPassword,
} from "@/lib/live-chat/security";
import {
  getValidPasswordResetByTokenHash,
  consumePasswordReset,
  updateVisitorAccount,
  revokeActiveSessionRecord,
} from "@/lib/live-chat/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const { token, newPassword } = body;
    if (!token || typeof token !== "string" || !newPassword || typeof newPassword !== "string") {
      return NextResponse.json({ error: "Token and new password are required." }, { status: 400 });
    }

    const passValidation = isStrongPassword(newPassword);
    if (!passValidation.valid) {
      return NextResponse.json({ error: passValidation.message }, { status: 400 });
    }

    const tokenHash = hashToken(token.trim());
    const resetRecord = await getValidPasswordResetByTokenHash(tokenHash);

    if (!resetRecord) {
      return NextResponse.json(
        { error: "Invalid or expired password reset link. Please request a new one." },
        { status: 400 },
      );
    }

    const { hash, salt } = hashPassword(newPassword);
    await updateVisitorAccount(resetRecord.accountId, {
      passwordHash: hash,
      passwordSalt: salt,
    });

    await consumePasswordReset(resetRecord.id);

    // Invalidate any active sessions for this account on all devices upon password reset
    await revokeActiveSessionRecord("visitor", resetRecord.email);

    return NextResponse.json({
      success: true,
      message: "Password has been successfully reset. Please sign in with your new password.",
    });
  } catch (error) {
    console.error("[Reset Password Error]:", error);
    return NextResponse.json({ error: "Failed to reset password. Please try again." }, { status: 500 });
  }
}

