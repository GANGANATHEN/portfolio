import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/live-chat/security";
import { revokeAdminSession } from "@/lib/live-chat/session-registry";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  await revokeAdminSession(token);

  const res = NextResponse.json({ success: true });
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
  return res;
}
