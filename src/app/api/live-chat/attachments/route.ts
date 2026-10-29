import { NextRequest, NextResponse } from "next/server";
import {
  VISITOR_COOKIE_NAME,
  ADMIN_COOKIE_NAME,
  hashToken,
  generateSecureToken,
  verifyAdminSessionToken,
} from "@/lib/live-chat/security";
import {
  getOrCreateConversationByHash,
  getConversationById,
  createAttachmentRecord,
  ATTACHMENTS_DIR,
} from "@/lib/live-chat/db";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const ALLOWED_MIME_TYPES = new Set([
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
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

const MAX_DOCUMENT_IMAGE_AUDIO_SIZE = 25 * 1024 * 1024; // 25 MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate either visitor or admin
    const adminCookie = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
    const isAdmin = verifyAdminSessionToken(adminCookie);

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

    if (isAdmin) {
      const targetId = formData.get("conversationId");
      if (typeof targetId === "string" && targetId.trim()) {
        const conv = await getConversationById(targetId.trim());
        conversationId = conv ? conv.id : targetId.trim();
      }
    } else {
      if (!visitorToken || visitorToken.length < 32) {
        visitorToken = generateSecureToken();
        isNewVisitorSession = true;
      }
      const tokenHash = hashToken(visitorToken);
      const conv = await getOrCreateConversationByHash(tokenHash);
      if (conv) conversationId = conv.id;
    }

    if (!conversationId) {
      return NextResponse.json(
        { error: "Unauthorized or missing valid conversation." },
        { status: 401 },
      );
    }

    // 2. Validate MIME type
    const mimeType = file.type.toLowerCase() || "application/octet-stream";
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
    const originalName = file.name || "attachment";
    const ext = path.extname(originalName).slice(0, 10).toLowerCase() || "";
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

