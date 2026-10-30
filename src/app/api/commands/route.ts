import { NextRequest, NextResponse } from "next/server";
import { getPublicCommands, createCommand } from "@/lib/commands/db";
import { parseClientMetadata } from "@/lib/commands/metadata";
import { sanitizeText } from "@/lib/live-chat/security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const commands = await getPublicCommands();
    return NextResponse.json({ success: true, commands }, { status: 200 });
  } catch (err) {
    console.error("[API Commands] Error loading public commands:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load commands. Please try again later." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const rawCommand = typeof body.command === "string" ? body.command : typeof body.testimonial === "string" ? body.testimonial : "";
    const rawAuthor = typeof body.author_name === "string" ? body.author_name : typeof body.name === "string" ? body.name : "";
    const rawTitle = typeof body.title === "string" ? body.title : "";
    const rawCategory = typeof body.category === "string" ? body.category : "General";
    const rawDescription = typeof body.description === "string" ? body.description : "";

    const command = rawCommand.trim();
    const author_name = sanitizeText(rawAuthor.trim());
    const title = sanitizeText(rawTitle.trim());
    const category = sanitizeText(rawCategory.trim()) || "General";
    const description = sanitizeText(rawDescription.trim());

    if (!command) {
      return NextResponse.json(
        { success: false, error: "Command content is required." },
        { status: 400 }
      );
    }

    if (command.length > 4000) {
      return NextResponse.json(
        { success: false, error: "Command content exceeds maximum allowed length (4000 characters)." },
        { status: 400 }
      );
    }

    if (!author_name) {
      return NextResponse.json(
        { success: false, error: "Author name or handle is required." },
        { status: 400 }
      );
    }

    if (author_name.length > 80) {
      return NextResponse.json(
        { success: false, error: "Author name exceeds maximum allowed length (80 characters)." },
        { status: 400 }
      );
    }

    // Extract safe non-invasive moderation metadata (server-generated with optional client metrics)
    const clientPayload = body.client_telemetry || body.clientMeta;
    const metadata = parseClientMetadata(req, clientPayload);

    const record = await createCommand(
      {
        command,
        author_name,
        title: title || undefined,
        category,
        description: description || undefined,
      },
      metadata
    );

    // Strip private metadata in public response
    const publicSafeCommand = {
      id: record.id,
      title: record.title,
      command: record.command,
      description: record.description,
      category: record.category,
      author_name: record.author_name,
      created_at: record.created_at,
    };

    return NextResponse.json(
      { success: true, command: publicSafeCommand },
      { status: 201 }
    );
  } catch (err) {
    console.error("[API Commands] Error creating command:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error submitting command." },
      { status: 500 }
    );
  }
}

