import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  verifyAdminPassword,
} from "@/lib/live-chat/security";
import { registerAdminActiveSession } from "@/lib/live-chat/session-registry";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const password = body?.password;

    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Password is required." }, { status: 400 });
    }

    if (!verifyAdminPassword(password)) {
      return NextResponse.json({ error: "Invalid admin password." }, { status: 401 });
    }

    const { token } = await registerAdminActiveSession();
    const res = NextResponse.json({ success: true, message: "Authenticated successfully." });

    res.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return res;
  } catch (error) {
    console.error("[Admin Login Error]:", error);
    return NextResponse.json({ error: "Authentication failed." }, { status: 500 });
  }
}
