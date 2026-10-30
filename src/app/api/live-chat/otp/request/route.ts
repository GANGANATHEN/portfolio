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
import {
  validateVisitorSession,
  createSessionRejectedResponse,
} from "@/lib/live-chat/session-registry";

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

    const auth = await validateVisitorSession(req);
    if (!auth.valid && auth.clearCookie) {
      return createSessionRejectedResponse(auth, VISITOR_COOKIE_NAME);
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
    const dispatchResult = await sendOtpVerificationEmail(email, otp);
    if (!dispatchResult.success) {
      console.warn(`[OTP Request] Email dispatch failed for ${email}:`, dispatchResult.errorCategory);

      if (dispatchResult.errorCategory === "domain_verification_required") {
        return NextResponse.json(
          {
            error:
              "Email delivery is restricted: The configured email provider test domain can only send to the registered administrator address (green11.dev@gmail.com). To enable OTPs for external visitors, a custom domain must be verified in Resend.",
            code: "DOMAIN_VERIFICATION_REQUIRED",
          },
          { status: 422 },
        );
      }

      if (dispatchResult.errorCategory === "missing_key") {
        return NextResponse.json(
          {
            error: "Email verification service is currently unconfigured. Please try again later.",
            code: "EMAIL_SERVICE_UNAVAILABLE",
          },
          { status: 503 },
        );
      }

      if (dispatchResult.errorCategory === "rate_limit") {
        return NextResponse.json(
          {
            error: "Too many email requests. Please wait a few minutes before trying again.",
            code: "PROVIDER_RATE_LIMIT",
          },
          { status: 429 },
        );
      }

      return NextResponse.json(
        {
          error: "Failed to send verification code to your email. Please verify the address and try again.",
          code: "DISPATCH_FAILED",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "A 6-digit verification code has been sent to your email.",
      cooldownSeconds: 60,
    });
  } catch (error) {
    console.error("[OTP Request Exception]:", error);
    const isDbUnavailable =
      error instanceof Error &&
      (error.message.includes("Production Database Error") ||
        error.message.includes("schema cache") ||
        error.message.includes("chat_conversations"));

    return NextResponse.json(
      {
        error: isDbUnavailable
          ? "Live chat service is temporarily unavailable. Please try again shortly."
          : "Failed to generate verification code. Please try again.",
        code: isDbUnavailable ? "DATABASE_UNAVAILABLE" : "INTERNAL_ERROR",
      },
      { status: isDbUnavailable ? 503 : 500 },
    );
  }
}

