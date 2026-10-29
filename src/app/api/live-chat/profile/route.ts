import { NextRequest, NextResponse } from "next/server";
import {
  VISITOR_COOKIE_NAME,
  generateSecureToken,
  hashToken,
  isValidEmail,
  sanitizeText,
} from "@/lib/live-chat/security";
import {
  getOrCreateConversationByHash,
  updateConversationProfile,
} from "@/lib/live-chat/db";

export async function POST(req: NextRequest) {
  try {
    let token = req.cookies.get(VISITOR_COOKIE_NAME)?.value;
    let isNewSession = false;

    if (!token || token.length < 32 || !/^[0-9a-fA-F]+$/.test(token)) {
      token = generateSecureToken();
      isNewSession = true;
    }

    const tokenHash = hashToken(token);
    await getOrCreateConversationByHash(tokenHash);

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid profile payload." }, { status: 400 });
    }

    const { name, email, emailNotificationsEnabled } = body;

    const sanitizedName = typeof name === "string" ? sanitizeText(name).slice(0, 80) : undefined;

    let sanitizedEmail: string | null | undefined = undefined;
    if (typeof email === "string") {
      const trimmed = email.trim();
      if (trimmed === "") {
        sanitizedEmail = null;
      } else {
        if (!isValidEmail(trimmed)) {
          return NextResponse.json(
            { error: "Please provide a valid email address." },
            { status: 400 },
          );
        }
        sanitizedEmail = trimmed.toLowerCase();
      }
    }

    const notifyConsent =
      typeof emailNotificationsEnabled === "boolean" ? emailNotificationsEnabled : undefined;

    const updated = await updateConversationProfile(tokenHash, {
      visitorName: sanitizedName,
      visitorEmail: sanitizedEmail,
      emailNotificationsEnabled: notifyConsent,
    });

    const res = NextResponse.json({
      success: true,
      profile: {
        visitorName: updated?.visitorName,
        visitorEmail: updated?.visitorEmail,
        emailVerified: updated?.emailVerified ?? false,
        emailNotificationsEnabled: updated?.emailNotificationsEnabled ?? false,
      },
    });

    if (isNewSession) {
      res.cookies.set({
        name: VISITOR_COOKIE_NAME,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
      });
    }

    return res;
  } catch (error) {
    console.error("[Profile Update Error]:", error);
    return NextResponse.json(
      { error: "Failed to update profile settings." },
      { status: 500 },
    );
  }
}
