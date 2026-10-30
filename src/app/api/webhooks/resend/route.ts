import { NextRequest, NextResponse } from "next/server";
import { getArchiveBatchByEmailMessageId } from "@/lib/live-chat/db";
import { confirmDeliveryAndPermanentlyDelete } from "@/lib/live-chat/archive";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
    }

    const eventType = body.type;
    const emailId = body.data?.email_id || body.data?.id;

    if (!emailId) {
      return NextResponse.json({ received: true, ignored: "no_email_id" }, { status: 200 });
    }

    // We specifically listen for email delivery confirmation
    if (eventType === "email.delivered") {
      const batch = await getArchiveBatchByEmailMessageId(emailId);

      if (batch && batch.status === "email_submitted") {
        const result = await confirmDeliveryAndPermanentlyDelete(batch.id, { force: true });
        return NextResponse.json({
          received: true,
          action: "permanently_deleted_messages",
          batchId: batch.id,
          deletedMessages: result.deletedCount,
        });
      }

      return NextResponse.json({
        received: true,
        action: "email_delivered_recorded",
        emailId,
      });
    }

    return NextResponse.json({ received: true, eventType });
  } catch (error) {
    console.error("[Resend Webhook Exception]:", error);
    return NextResponse.json({ error: "Webhook processing error." }, { status: 500 });
  }
}

