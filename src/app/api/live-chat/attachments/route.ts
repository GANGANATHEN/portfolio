import { NextRequest, NextResponse } from "next/server";
import {
  VISITOR_COOKIE_NAME,
  ADMIN_COOKIE_NAME,
  hashToken,
  generateSecureToken,
} from "@/lib/live-chat/security";
import {
  getOrCreateConversationByHash,
  getConversationById,
  createAttachmentRecord,
  ATTACHMENTS_DIR,
} from "@/lib/live-chat/db";
import {
  validateAdminSession,
  validateVisitorSession,
  createSessionRejectedResponse,
} from "@/lib/live-chat/session-registry";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const ALLOWED_MIME_TYPES = new Set([
  // Images
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
  "image/pjpeg",
  "image/x-png",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/heic",
  "image/heif",
  // Videos
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/ogg",
  "video/x-matroska",
  // Audio
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp4",
  "audio/webm",
  "audio/aac",
  "audio/x-m4a",
  "audio/flac",
  // Documents & Files
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
  "text/html",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-tar",
  "application/gzip",
  "application/json",
  "application/xml",
]);

const EXT_MIME_FALLBACK: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".md": "text/markdown",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".zip": "application/zip",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const MAX_DOCUMENT_IMAGE_AUDIO_SIZE = 25 * 1024 * 1024; // 25 MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate either visitor or admin
    const adminCookie = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
    let isAdmin = false;
    if (adminCookie) {
      const authAdmin = await validateAdminSession(req);
      if (authAdmin.authenticated) {
        isAdmin = true;
      } else if (req.headers.get("content-type")?.includes("multipart/form-data")) {
        // If an explicit admin request with superseded session
        const formPreview = await req.clone().formData().catch(() => null);
        if (formPreview?.get("conversationId")) {
          return createSessionRejectedResponse(authAdmin, ADMIN_COOKIE_NAME);
        }
      }
    }

    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: "Invalid multipart form data." }, { status: 400 });
    }

    const file = formData.get("file") as File | null;
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing or invalid file." }, { status: 400 });
    }

    let conversationId: string | null = null;
    let isNewVisitorSession = false;
    let visitorToken = req.cookies.get(VISITOR_COOKIE_NAME)?.value;
    const targetId = formData.get("conversationId");

    // Case 1: Admin uploading to a specified conversation from Admin Inbox
    if (isAdmin && typeof targetId === "string" && targetId.trim()) {
      const conv = await getConversationById(targetId.trim());
      conversationId = conv ? conv.id : targetId.trim();
    }

    // Case 2: Visitor upload (or admin testing in visitor live chat widget)
    if (!conversationId) {
      if (visitorToken && visitorToken.length >= 32) {
        const authVisitor = await validateVisitorSession(req);
        if (!authVisitor.valid && authVisitor.clearCookie) {
          return createSessionRejectedResponse(authVisitor, VISITOR_COOKIE_NAME);
        }
        if (authVisitor.valid && authVisitor.conversation) {
          if (typeof targetId === "string" && targetId.trim() && targetId.trim() !== authVisitor.conversation.id) {
            return NextResponse.json(
              { error: "Unauthorized conversation access." },
              { status: 403 },
            );
          }
          conversationId = authVisitor.conversation.id;
        }
      }

      if (!conversationId) {
        if (!visitorToken || visitorToken.length < 32) {
          visitorToken = generateSecureToken();
          isNewVisitorSession = true;
        }
        const tokenHash = hashToken(visitorToken);
        const conv = await getOrCreateConversationByHash(tokenHash);
        if (conv) {
          if (typeof targetId === "string" && targetId.trim() && targetId.trim() !== conv.id) {
            return NextResponse.json(
              { error: "Unauthorized conversation access." },
              { status: 403 },
            );
          }
          conversationId = conv.id;
        }
      }
    }

    if (!conversationId) {
      return NextResponse.json(
        { error: "Unauthorized or missing valid conversation." },
        { status: 401 },
      );
    }

    // 2. Validate & Normalize MIME type
    const originalName = file.name || "attachment";
    const ext = path.extname(originalName).slice(0, 10).toLowerCase() || "";
    const rawMime = (file.type || "").split(";")[0].trim().toLowerCase();
    let mimeType = rawMime;

    if (!mimeType || mimeType === "application/octet-stream") {
      if (ext && EXT_MIME_FALLBACK[ext]) {
        mimeType = EXT_MIME_FALLBACK[ext];
      } else {
        mimeType = "application/octet-stream";
      }
    } else if (mimeType === "image/jpg" || mimeType === "image/pjpeg") {
      mimeType = "image/jpeg";
    }

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Please upload standard images, videos, audio, PDFs, or documents.",
        },
        { status: 400 },
      );
    }

    // 3. Validate File Size
    const isVideo = mimeType.startsWith("video/");
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_DOCUMENT_IMAGE_AUDIO_SIZE;
    if (file.size > maxSize) {
      const limitMb = Math.round(maxSize / (1024 * 1024));
      return NextResponse.json(
        { error: `File exceeds maximum allowed size of ${limitMb}MB.` },
        { status: 400 },
      );
    }

    // 4. Sanitize file name & extension
    const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_\-\s]/g, "").slice(0, 80);
    const safeFileName = `${baseName || "file"}${ext}`;

    const uniqueId = crypto.randomUUID();
    const storedRelativePath = `${conversationId}/${uniqueId}${ext}`;
    const destinationFolder = path.join(ATTACHMENTS_DIR, conversationId);
    const destinationPath = path.join(ATTACHMENTS_DIR, storedRelativePath);

    // Ensure directory exists
    if (!fs.existsSync(destinationFolder)) {
      fs.mkdirSync(destinationFolder, { recursive: true });
    }

    // Write file to disk
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(destinationPath, buffer);

    // Save attachment database record
    const attachment = await createAttachmentRecord({
      conversationId,
      fileName: safeFileName,
      fileSize: file.size,
      mimeType,
      storagePath: storedRelativePath,
    });

    const response = NextResponse.json({
      success: true,
      attachment: {
        id: attachment.id,
        conversationId: attachment.conversationId,
        fileName: attachment.fileName,
        fileSize: attachment.fileSize,
        mimeType: attachment.mimeType,
        createdAt: attachment.createdAt,
        url: `/api/live-chat/attachments/${attachment.id}`,
      },
    });

    if (isNewVisitorSession && visitorToken) {
      response.cookies.set({
        name: VISITOR_COOKIE_NAME,
        value: visitorToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
      });
    }

    return response;
  } catch (error) {
    console.error("[Attachment Upload Error]:", error);
    return NextResponse.json(
      { error: "Failed to upload file. Please try again." },
      { status: 500 },
    );
  }
}

