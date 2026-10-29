import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/live-chat/security";
import { getFullConversationHistoryForPdf } from "@/lib/live-chat/db";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (!verifyAdminSessionToken(token)) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const conversationId = req.nextUrl.searchParams.get("conversationId");
    if (!conversationId) {
      return NextResponse.json({ error: "Missing conversationId parameter." }, { status: 400 });
    }

    const history = await getFullConversationHistoryForPdf(conversationId);
    if (!history) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    const { conversation, messages } = history;

    // Create PDF Document using pdf-lib
    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    const pageWidth = 595.28; // A4
    const pageHeight = 841.89;
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    function checkPageBreak(requiredHeight: number) {
      if (y - requiredHeight < margin + 30) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
        drawPageHeader();
      }
    }

    function drawPageHeader() {
      page.drawText("GANGANATHAN PORTFOLIO — LIVE VISITOR CHAT RECORD", {
        x: margin,
        y: y - 10,
        size: 9,
        font: fontBold,
        color: rgb(0.5, 0.5, 0.55),
      });
      page.drawLine({
        start: { x: margin, y: y - 15 },
        end: { x: pageWidth - margin, y: y - 15 },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.85),
      });
      y -= 30;
    }

    // First page document header banner
    page.drawRectangle({
      x: margin,
      y: y - 55,
      width: contentWidth,
      height: 60,
      color: rgb(0.02, 0.03, 0.09), // Dark space aesthetic #050816
    });

    page.drawText("CONFIDENTIAL CONVERSATION TRANSCRIPT", {
      x: margin + 14,
      y: y - 22,
      size: 13,
      font: fontBold,
      color: rgb(0.13, 0.83, 0.93), // Cyan #22d3ee
    });

    const exportTimestamp = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
    page.drawText(`Generated: ${exportTimestamp} | ID: ${conversation.id}`, {
      x: margin + 14,
      y: y - 42,
      size: 8,
      font: fontRegular,
      color: rgb(0.8, 0.8, 0.85),
    });

    y -= 75;

    // Metadata block
    const visitorTitle = conversation.visitorName || "Anonymous Visitor";
    const emailTitle = conversation.visitorEmail
      ? `${conversation.visitorEmail} (${conversation.emailVerified ? "Verified" : "Unverified"})`
      : "No Email (Guest Session)";

    page.drawText(`Visitor: ${visitorTitle}`, {
      x: margin,
      y,
      size: 10,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.15),
    });
    y -= 14;

    page.drawText(`Email Status: ${emailTitle}`, {
      x: margin,
      y,
      size: 9,
      font: fontRegular,
      color: rgb(0.2, 0.2, 0.25),
    });
    y -= 14;

    page.drawText(`Conversation Started: ${conversation.createdAt} | Total Messages: ${messages.length}`, {
      x: margin,
      y,
      size: 8,
      font: fontRegular,
      color: rgb(0.4, 0.4, 0.45),
    });
    y -= 20;

    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 1,
      color: rgb(0.85, 0.85, 0.9),
    });
    y -= 20;

    // Sanitize string for standard PDF WinAnsiEncoding
    function sanitizeForPdf(text: string): string {
      if (!text) return "";
      return text
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014\u2500\u2015]/g, "-")
        .replace(/[\u21B3\u2192]/g, ">")
        .replace(/[^\x20-\x7E]/g, "?");
    }

    // Word wrapping helper
    function wrapText(text: string, maxW: number, font: typeof fontRegular, size: number): string[] {
      const sanitized = sanitizeForPdf(text);
      const words = sanitized.replace(/[\r\n]+/g, " ").split(" ");
      const lines: string[] = [];
      let currentLine = "";

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const w = font.widthOfTextAtSize(testLine, size);
        if (w <= maxW) {
          currentLine = testLine;
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) lines.push(currentLine);
      return lines;
    }

    let lastMessageDate = "";

    // Draw message stream
    for (const msg of messages) {
      const msgDate = new Date(msg.createdAt).toLocaleDateString([], {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      // Date separator
      if (msgDate !== lastMessageDate) {
        lastMessageDate = msgDate;
        checkPageBreak(35);
        page.drawLine({
          start: { x: margin, y: y - 5 },
          end: { x: pageWidth - margin, y: y - 5 },
          thickness: 0.5,
          color: rgb(0.88, 0.88, 0.9),
        });
        page.drawText(`--- ${msgDate} ---`, {
          x: pageWidth / 2 - 40,
          y: y - 8,
          size: 8,
          font: fontBold,
          color: rgb(0.5, 0.5, 0.6),
        });
        y -= 25;
      }

      const isOwner = msg.senderType === "owner";
      const senderLabel = isOwner ? "PORTFOLIO OWNER (Ganganathan)" : `VISITOR (${conversation.visitorName || "Guest"})`;
      const timeStr = new Date(msg.createdAt).toISOString().replace("T", " ").slice(0, 19) + " UTC";
      const editLabel = msg.isEdited ? " (edited)" : "";

      const rawContent = msg.isDeleted ? "[Message deleted]" : msg.content;
      const contentLines = wrapText(rawContent, contentWidth - 30, fontRegular, 9);
      const bubbleHeight = contentLines.length * 13 + 36;

      checkPageBreak(bubbleHeight + 10);

      // Bubble background
      page.drawRectangle({
        x: margin,
        y: y - bubbleHeight,
        width: contentWidth,
        height: bubbleHeight,
        color: isOwner ? rgb(0.96, 0.94, 0.99) : rgb(0.94, 0.98, 1.0),
        borderWidth: 0.5,
        borderColor: isOwner ? rgb(0.8, 0.7, 0.9) : rgb(0.7, 0.85, 0.95),
      });

      // Sender and timestamp header
      page.drawText(sanitizeForPdf(`${senderLabel}${editLabel}`), {
        x: margin + 12,
        y: y - 16,
        size: 8.5,
        font: fontBold,
        color: isOwner ? rgb(0.4, 0.15, 0.6) : rgb(0.05, 0.4, 0.55),
      });

      page.drawText(timeStr, {
        x: pageWidth - margin - 110,
        y: y - 16,
        size: 7.5,
        font: fontRegular,
        color: rgb(0.45, 0.45, 0.5),
      });

      let textY = y - 30;

      // Quoted reply reference if present
      if (msg.replyPreview) {
        const replyLine = sanitizeForPdf(`> Quoting [${msg.replyPreview.senderType}]: "${msg.replyPreview.content.slice(0, 70)}..."`);
        page.drawText(replyLine, {
          x: margin + 12,
          y: textY,
          size: 7.5,
          font: fontItalic,
          color: rgb(0.4, 0.4, 0.45),
        });
        textY -= 12;
      }

      // Message body
      for (const line of contentLines) {
        page.drawText(line, {
          x: margin + 12,
          y: textY,
          size: 9,
          font: fontRegular,
          color: rgb(0.1, 0.1, 0.15),
        });
        textY -= 13;
      }

      // Attachment metadata if present
      if (msg.attachments && msg.attachments.length > 0) {
        for (const att of msg.attachments) {
          const sizeKb = Math.round(att.fileSize / 1024);
          const attText = sanitizeForPdf(`[Attachment: ${att.fileName} (${att.mimeType}, ${sizeKb} KB)]`);
          page.drawText(attText, {
            x: margin + 12,
            y: textY,
            size: 8,
            font: fontBold,
            color: rgb(0.2, 0.45, 0.7),
          });
          textY -= 12;
        }
      }

      // Reactions if present
      if (msg.reactions && Object.keys(msg.reactions).length > 0) {
        const rxSummary = Object.entries(msg.reactions)
          .map(([emoji, users]) => `${emoji} (${users.length})`)
          .join("  ");
        page.drawText(sanitizeForPdf(`Reactions: ${rxSummary}`), {
          x: margin + 12,
          y: textY,
          size: 7.5,
          font: fontRegular,
          color: rgb(0.4, 0.4, 0.45),
        });
        textY -= 10;
      }

      y -= bubbleHeight + 12;
    }

    // Number all pages
    const totalPages = pdfDoc.getPageCount();
    pdfDoc.getPages().forEach((p, idx) => {
      p.drawText(`Page ${idx + 1} of ${totalPages}`, {
        x: pageWidth / 2 - 25,
        y: 18,
        size: 8,
        font: fontRegular,
        color: rgb(0.5, 0.5, 0.55),
      });
    });

    const pdfBytes = await pdfDoc.save();
    const safeVisitorName = (conversation.visitorName || "visitor")
      .replace(/[^a-zA-Z0-9_\-]/g, "_")
      .slice(0, 30);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const downloadFilename = `chat-export-${safeVisitorName}-${dateStamp}.pdf`;

    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${downloadFilename}"`,
        "Content-Length": pdfBytes.byteLength.toString(),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[PDF Export Exception]:", error);
    return NextResponse.json(
      { error: "Failed to generate conversation PDF." },
      { status: 500 },
    );
  }
}

