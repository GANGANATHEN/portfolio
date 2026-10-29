import { NextRequest, NextResponse } from "next/server";
import {
  VISITOR_COOKIE_NAME,
  hashToken,
  isValidEmail,
  generateOtp,
  hashOtp,
} from "@/lib/live-chat/security";
import {
  getOrCreateConversationByHash,
  createEmailOtp,
  getLatestEmailOtp,
} from "@/lib/live-chat/db";
import { sendOtpVerificationEmail } from "@/lib/live-chat/email";

// In-memory sliding-window tracker for OTP abuse prevention
interface OtpThrottleEntry {
  lastRequestedAt: number;
  hourlyCount: number;
  windowStart: number;
}
const otpThrottles = new Map<string, OtpThrottleEntry>();

const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds resend cooldown
const MAX_OTP_HOURLY = 5; // Max 5 OTPs per hour per conversation
const ONE_HOUR_MS = 60 * 60 * 1000;

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
    if (!body || typeof body.email !== "string") {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 },
      );
    }

    const email = body.email.trim().toLowerCase();
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address format." },
        { status: 400 },
      );
    }

    // Rate Limiting & Cooldown Check
    const now = Date.now();
    const throttleKey = `${conversation.id}:${email}`;
    const throttle = otpThrottles.get(throttleKey);

    if (throttle) {
      // Check 60-second cooldown
      const elapsed = now - throttle.lastRequestedAt;
      if (elapsed < RESEND_COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
        return NextResponse.json(
          {
            error: `Please wait ${remainingSeconds} seconds before requesting a new code.`,
            retryAfter: remainingSeconds,
          },
          { status: 429 },
        );
      }

      // Check 1-hour max limit
      if (now - throttle.windowStart < ONE_HOUR_MS) {
        if (throttle.hourlyCount >= MAX_OTP_HOURLY) {
          return NextResponse.json(
            { error: "Too many verification requests. Please try again in an hour." },
            { status: 429 },
          );
        }
        throttle.hourlyCount += 1;
      } else {
        throttle.windowStart = now;
        throttle.hourlyCount = 1;
      }
      throttle.lastRequestedAt = now;
    } else {
      otpThrottles.set(throttleKey, {
        lastRequestedAt: now,
        hourlyCount: 1,
        windowStart: now,
      });
    }

    // Check if there is an unexpired unused OTP
    const existingOtp = await getLatestEmailOtp(conversation.id, email);
    if (existingOtp && !existingOtp.usedAt) {
      const createdTime = new Date(existingOtp.createdAt).getTime();
      if (now - createdTime < RESEND_COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((RESEND_COOLDOWN_MS - (now - createdTime)) / 1000);
        return NextResponse.json(
          {
            error: `A code was recently sent. Please wait ${remainingSeconds} seconds before requesting a new code.`,
            retryAfter: remainingSeconds,
          },
          { status: 429 },
        );
      }
    }

    // Generate cryptographic 6-digit OTP
    const otp = generateOtp();
    const otpHash = hashOtp(email, otp);
    const expiresAt = new Date(now + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Durably store hashed OTP in database
    await createEmailOtp(conversation.id, email, otpHash, expiresAt);

    // Send email via configured provider
    const dispatched = await sendOtpVerificationEmail(email, otp);
    if (!dispatched) {
      console.warn(`[OTP Request] Email dispatch failed for ${email}`);
    }

    return NextResponse.json({
      success: true,
      message: "A 6-digit verification code has been sent to your email.",
      cooldownSeconds: 60,
    });
  } catch (error) {
    console.error("[OTP Request Exception]:", error);
    return NextResponse.json(
      { error: "Failed to generate verification code. Please try again." },
      { status: 500 },
    );
  }
}

