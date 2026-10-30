import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/live-chat/security";
import { validateAdminSession, createSessionRejectedResponse } from "@/lib/live-chat/session-registry";
import { getSessionHistory, getActiveSessionsSummary } from "@/lib/live-chat/db";

export async function GET(req: NextRequest) {
  try {
    const authAdmin = await validateAdminSession(req);
    if (!authAdmin.authenticated) {
      if (authAdmin.clearCookie) {
        return createSessionRejectedResponse(authAdmin, ADMIN_COOKIE_NAME);
      }
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || undefined;
    const accountType = searchParams.get("accountType") || undefined;
    const status = searchParams.get("status") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "15", 10)));
    const offset = (page - 1) * pageSize;

    const [historyData, summary] = await Promise.all([
      getSessionHistory({
        search,
        accountType,
        status,
        startDate,
        endDate,
        limit: pageSize,
        offset,
      }),
      getActiveSessionsSummary(),
    ]);

    const totalPages = Math.ceil(historyData.total / pageSize) || 1;

    return NextResponse.json({
      success: true,
      sessions: historyData.records,
      summary,
      pagination: {
        page,
        pageSize,
        total: historyData.total,
        totalPages,
      },
    });
  } catch (error) {
    console.error("[Admin Login Info API Error]:", error);
    return NextResponse.json({ error: "Failed to load session telemetry." }, { status: 500 });
  }
}

