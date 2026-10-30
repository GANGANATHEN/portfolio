import { NextRequest, NextResponse } from "next/server";
import {
  VISITOR_COOKIE_NAME,
  ADMIN_COOKIE_NAME,
  hashToken,
} from "@/lib/live-chat/security";
import {
  getAttachmentById,
  getConversationById,
  ATTACHMENTS_DIR,
  checkSupabaseAvailable,
} from "@/lib/live-chat/db";
import {
  validateAdminSession,
  validateVisitorSession,
  createSessionRejectedResponse,
} from "@/lib/live-chat/session-registry";
import { getServerSupabase } from "@/lib/supabase";
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
    let isAuthorized = false;

    if (adminCookie) {
      const authAdmin = await validateAdminSession(req);
      if (authAdmin.authenticated) {
        isAuthorized = true;
      } else if (authAdmin.clearCookie) {
        return createSessionRejectedResponse(authAdmin, ADMIN_COOKIE_NAME);
      }
    }

    if (!isAuthorized) {
      const authVisitor = await validateVisitorSession(req);
      if (!authVisitor.valid && authVisitor.clearCookie) {
        return createSessionRejectedResponse(authVisitor, VISITOR_COOKIE_NAME);
      }
      if (authVisitor.valid && authVisitor.conversation && authVisitor.conversation.id === attachment.conversationId) {
        isAuthorized = true;
      } else if (authVisitor.valid && authVisitor.tokenHash) {
        // Double check conversation session token hash
        const conv = await getConversationById(attachment.conversationId);
        if (conv && conv.sessionTokenHash === authVisitor.tokenHash) {
          isAuthorized = true;
        }
      }
    }

    // Fallback: If visitor holds valid guest token for this conversation
    if (!isAuthorized) {
      const visitorToken = req.cookies.get(VISITOR_COOKIE_NAME)?.value;
      if (visitorToken && visitorToken.length >= 32) {
        const tokenHash = hashToken(visitorToken);
        const conv = await getConversationById(attachment.conversationId);
        if (conv && conv.sessionTokenHash === tokenHash) {
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

    let fileBuffer: Buffer | null = null;

    // 2. Fetch file buffer from Supabase Storage first
    try {
      const isSupabaseReady = await checkSupabaseAvailable();
      if (isSupabaseReady) {
        const serverClient = getServerSupabase();
        const { data, error } = await serverClient.storage
          .from("chat-attachments")
          .download(attachment.storagePath);
        if (data && !error) {
          fileBuffer = Buffer.from(await data.arrayBuffer());
        }
      }
    } catch (e) {
      console.warn("[Attachment Stream] Supabase download fallback:", e);
    }

    // 3. Fall back to local filesystem if not found in Supabase Storage
    if (!fileBuffer) {
      const filePath = path.join(/*turbopackIgnore: true*/ ATTACHMENTS_DIR, attachment.storagePath);
      if (fs.existsSync(filePath)) {
        fileBuffer = fs.readFileSync(filePath);
      }
    }

    if (!fileBuffer) {
      return NextResponse.json({ error: "Attachment file content not found." }, { status: 404 });
    }

    const isDownload = req.nextUrl.searchParams.get("download") === "true";
    const dispositionType = isDownload ? "attachment" : "inline";

    // Safe filename encoding for Content-Disposition
    const safeAsciiName = attachment.fileName.replace(/[^\x20-\x7E]/g, "_");

    return new Response(new Uint8Array(fileBuffer), {
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
