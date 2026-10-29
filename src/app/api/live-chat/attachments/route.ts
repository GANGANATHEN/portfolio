import { NextRequest, NextResponse } from "next/server";
import {
  VISITOR_COOKIE_NAME,
  ADMIN_COOKIE_NAME,
  hashToken,
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
  // Videos
  "video/mp4",
  "video/webm",
  "video/quicktime",
  // Audio
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp4",
  "audio/webm",
]);

const MAX_IMAGE_AUDIO_SIZE = 15 * 1024 * 1024; // 15 MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate either visitor or admin
    const visitorCookie = req.cookies.get(VISITOR_COOKIE_NAME)?.value;
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

    if (isAdmin) {
      const targetId = formData.get("conversationId");
      if (typeof targetId === "string" && targetId.trim()) {
        const conv = await getConversationById(targetId.trim());
        if (conv) conversationId = conv.id;
      }
    } else if (visitorCookie) {
      const conv = await getOrCreateConversationByHash(hashToken(visitorCookie));
      if (conv) conversationId = conv.id;
    }

    if (!conversationId) {
      return NextResponse.json(
        { error: "Unauthorized or missing valid conversation." },
        { status: 401 },
      );
    }

    // 2. Validate MIME type
    const mimeType = file.type.toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Only images (PNG, JPEG, WebP, GIF), videos (MP4, WebM, MOV), and audio (MP3, WAV, OGG) are allowed.",
        },
        { status: 400 },
      );
    }

    // 3. Validate File Size
    const isVideo = mimeType.startsWith("video/");
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_AUDIO_SIZE;
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

    return NextResponse.json({
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
  } catch (error) {
    console.error("[Attachment Upload Error]:", error);
    return NextResponse.json(
      { error: "Failed to upload file. Please try again." },
      { status: 500 },
    );
  }
}

