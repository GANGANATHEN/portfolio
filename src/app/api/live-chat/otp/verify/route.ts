import { NextRequest, NextResponse } from "next/server";
import {
  VISITOR_COOKIE_NAME,
  hashToken,
  isValidEmail,
  verifyOtpHash,
} from "@/lib/live-chat/security";
import {
  getOrCreateConversationByHash,
  getLatestEmailOtp,
  incrementOtpAttempts,
  markOtpUsed,
  setConversationEmailVerified,
} from "@/lib/live-chat/db";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(VISITOR_COOKIE_NAME)?.value;
    if (!token || token.length < 32) {
      return NextResponse.json(
        { error: "Active chat session required. Please refresh." },
        { status: 401 },
      );
    }

    const tokenHash = hashToken(token);
    const conversation = await getOrCreateConversationByHash(tokenHash);

    const body = await req.json().catch(() => null);
    if (!body || typeof body.email !== "string" || typeof body.otp !== "string") {
      return NextResponse.json(
        { error: "Email and 6-digit verification code are required." },
        { status: 400 },
      );
    }

    const email = body.email.trim().toLowerCase();
    const candidateOtp = body.otp.trim();

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email format." },
        { status: 400 },
      );
    }

    if (!/^\d{6}$/.test(candidateOtp)) {
      return NextResponse.json(
        { error: "Verification code must be exactly 6 numeric digits." },
        { status: 400 },
      );
    }

    const otpRecord = await getLatestEmailOtp(conversation.id, email);
    if (!otpRecord) {
      return NextResponse.json(
        { error: "No pending verification code found for this email. Please request a new code." },
        { status: 400 },
      );
    }

    // Check if already used
    if (otpRecord.usedAt) {
      return NextResponse.json(
        { error: "This verification code has already been used. Please request a new code." },
        { status: 400 },
      );
    }

    // Check expiration (10 minutes)
    const now = Date.now();
    const expiresTime = new Date(otpRecord.expiresAt).getTime();
    if (now > expiresTime) {
      return NextResponse.json(
        { error: "Verification code has expired. Please request a new code." },
        { status: 400 },
      );
    }

    // Check max attempts
    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      await markOtpUsed(otpRecord.id); // Invalidate exhausted code
      return NextResponse.json(
        { error: "Too many failed verification attempts. This code is invalidated. Please request a new code." },
        { status: 400 },
      );
    }

    // Constant-time hash verification
    const isValid = verifyOtpHash(email, candidateOtp, otpRecord.otpHash);

    if (!isValid) {
      const newAttempts = await incrementOtpAttempts(otpRecord.id);
      const remaining = otpRecord.maxAttempts - newAttempts;
      if (remaining <= 0) {
        await markOtpUsed(otpRecord.id);
        return NextResponse.json(
          { error: "Invalid verification code. Maximum attempts reached. Please request a new code." },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: `Invalid verification code. ${remaining} attempt(s) remaining.` },
        { status: 400 },
      );
    }

    // Successfully verified!
    // 1. Mark OTP as used (single use)
    await markOtpUsed(otpRecord.id);

    // 2. Atomically set email_verified = true on conversation
    const updatedConv = await setConversationEmailVerified(conversation.id, email);

    return NextResponse.json({
      success: true,
      emailVerified: true,
      visitorEmail: updatedConv?.visitorEmail || email,
      emailNotificationsEnabled: true,
      message: "Email verified successfully! You will receive email notifications when Ganganathan replies.",
    });
  } catch (error) {
    console.error("[OTP Verify Exception]:", error);
    const isDbUnavailable =
      error instanceof Error &&
      (error.message.includes("Production Database Error") ||
        error.message.includes("schema cache") ||
        error.message.includes("chat_conversations"));

    return NextResponse.json(
      {
        error: isDbUnavailable
          ? "Live chat service is temporarily unavailable. Please try again shortly."
          : "Failed to verify code. Please try again.",
        code: isDbUnavailable ? "DATABASE_UNAVAILABLE" : "INTERNAL_ERROR",
      },
      { status: isDbUnavailable ? 503 : 500 },
    );
  }
}

