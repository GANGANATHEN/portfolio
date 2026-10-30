import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/live-chat/security";
import { validateAdminSession, createSessionRejectedResponse } from "@/lib/live-chat/session-registry";
import { getAllArchiveBatches, getArchiveBatchById } from "@/lib/live-chat/db";
import {
  runRetentionArchiveJob,
  confirmDeliveryAndPermanentlyDelete,
} from "@/lib/live-chat/archive";

async function isAuthorized(req: NextRequest): Promise<{ ok: boolean; response?: NextResponse }> {
  const cookieToken = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (cookieToken) {
    const auth = await validateAdminSession(req);
    if (auth.authenticated) return { ok: true };
    return { ok: false, response: createSessionRejectedResponse(auth, ADMIN_COOKIE_NAME) };
  }

  // Support Authorization header for serverless cron jobs
  const authHeader = req.headers.get("authorization");
  const secretKey = (process.env.ADMIN_SECRET_KEY || "").trim();
  if (authHeader && secretKey && authHeader === `Bearer ${secretKey}`) {
    return { ok: true };
  }

  const cronHeader = req.headers.get("x-cron-secret");
  if (cronHeader && secretKey && cronHeader === secretKey) {
    return { ok: true };
  }

  return { ok: false };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await isAuthorized(req);
    if (!auth.ok) {
      return auth.response || NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const conversationId = req.nextUrl.searchParams.get("conversationId") || undefined;
    const batchId = req.nextUrl.searchParams.get("batchId");

    if (batchId) {
      const batch = await getArchiveBatchById(batchId);
      if (!batch) {
        return NextResponse.json({ error: "Archive batch not found." }, { status: 404 });
      }
      return NextResponse.json({ success: true, batch });
    }

    const batches = await getAllArchiveBatches(conversationId);
    return NextResponse.json({ success: true, batches });
  } catch (error) {
    console.error("[Admin Archive GET Error]:", error);
    return NextResponse.json({ error: "Failed to load archive batches." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await isAuthorized(req);
    if (!auth.ok) {
      return auth.response || NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    // If batchId provided with action === "confirm", confirm delivery and trigger permanent deletion
    if (body.batchId && body.action === "confirm_delivery") {
      const result = await confirmDeliveryAndPermanentlyDelete(body.batchId, {
        force: Boolean(body.force),
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error || "Confirmation failed." }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        batchId: body.batchId,
        deletedMessages: result.deletedCount,
      });
    }

    // Otherwise run retention archive pipeline
    const retentionMs =
      typeof body.retentionMs === "number" && body.retentionMs > 0 ? body.retentionMs : undefined;

    const autoConfirmDelivery = Boolean(body.autoConfirmDelivery);

    const report = await runRetentionArchiveJob({
      retentionMs,
      autoConfirmDelivery,
    });

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error("[Admin Archive POST Error]:", error);
    return NextResponse.json({ error: "Failed to execute archive job." }, { status: 500 });
  }
}

