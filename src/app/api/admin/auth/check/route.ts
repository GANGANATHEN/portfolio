import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/live-chat/security";
import { validateAdminSession } from "@/lib/live-chat/session-registry";

export async function GET(req: NextRequest) {
  const auth = await validateAdminSession(req);
  if (!auth.authenticated) {
    const res = NextResponse.json(
      {
        authenticated: false,
        error: auth.error,
        code: auth.code,
      },
      { status: 401 },
    );

    if (auth.clearCookie) {
      res.cookies.set({
        name: ADMIN_COOKIE_NAME,
        value: "",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
        expires: new Date(0),
      });
    }
    return res;
  }
  return NextResponse.json({ authenticated: true });
}
