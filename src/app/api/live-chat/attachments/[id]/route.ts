import { NextRequest, NextResponse } from "next/server";
import {
  VISITOR_COOKIE_NAME,
  ADMIN_COOKIE_NAME,
  hashToken,
  verifyAdminSessionToken,
} from "@/lib/live-chat/security";
import {
  getAttachmentById,
  getConversationByHash,
  ATTACHMENTS_DIR,
} from "@/lib/live-chat/db";
import fs from "fs";
import path from "path";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Missing attachment ID." }, { status: 400 });
    }

    const attachment = await getAttachmentById(id);
    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
    }

    // 1. Authorization Check
    const adminCookie = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
    const isAdmin = verifyAdminSessionToken(adminCookie);

    let isAuthorized = false;
    if (isAdmin) {
      isAuthorized = true;
    } else {
      const visitorCookie = req.cookies.get(VISITOR_COOKIE_NAME)?.value;
      if (visitorCookie) {
        const conv = await getConversationByHash(hashToken(visitorCookie));
        if (conv && conv.id === attachment.conversationId) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "You are not authorized to view or download this attachment." },
        { status: 403 },
      );
    }

    // 2. Resolve local file path
    const filePath = path.join(ATTACHMENTS_DIR, attachment.storagePath);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found on server." }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const isDownload = req.nextUrl.searchParams.get("download") === "true";
    const dispositionType = isDownload ? "attachment" : "inline";

    // Safe filename encoding for Content-Disposition
    const safeAsciiName = attachment.fileName.replace(/[^\x20-\x7E]/g, "_");

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Disposition": `${dispositionType}; filename="${safeAsciiName}"; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
        "Content-Length": fileBuffer.length.toString(),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[Attachment Stream Error]:", error);
    return NextResponse.json(
      { error: "Failed to stream attachment." },
      { status: 500 },
    );
  }
}

