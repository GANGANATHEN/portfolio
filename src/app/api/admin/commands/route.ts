import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/live-chat/security";
import { validateAdminSession, createSessionRejectedResponse } from "@/lib/live-chat/session-registry";
import {
  getAllCommandsForAdmin,
  getCommandStats,
  setCommandVisibility,
  deleteCommand,
} from "@/lib/commands/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await validateAdminSession(req);
  if (!auth.authenticated) {
    return createSessionRejectedResponse(auth, ADMIN_COOKIE_NAME);
  }

  try {
    const [commands, stats] = await Promise.all([
      getAllCommandsForAdmin(),
      getCommandStats(),
    ]);

    return NextResponse.json({ success: true, commands, stats }, { status: 200 });
  } catch (err) {
    console.error("[Admin API Commands] Error fetching admin commands:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error fetching commands." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await validateAdminSession(req);
  if (!auth.authenticated) {
    return createSessionRejectedResponse(auth, ADMIN_COOKIE_NAME);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { id, action } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing command id." },
        { status: 400 }
      );
    }

    if (action === "hide") {
      const ok = await setCommandVisibility(id, true);
      return NextResponse.json({ success: ok, id, action: "hide" });
    } else if (action === "restore") {
      const ok = await setCommandVisibility(id, false);
      return NextResponse.json({ success: ok, id, action: "restore" });
    } else if (action === "delete") {
      const ok = await deleteCommand(id);
      return NextResponse.json({ success: ok, id, action: "delete" });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action. Supported: hide, restore, delete." },
      { status: 400 }
    );
  } catch (err) {
    console.error("[Admin API Commands] Error updating command:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error updating command." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await validateAdminSession(req);
  if (!auth.authenticated) {
    return createSessionRejectedResponse(auth, ADMIN_COOKIE_NAME);
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing required query parameter: id" },
        { status: 400 }
      );
    }

    const ok = await deleteCommand(id);
    return NextResponse.json({ success: ok, id, action: "deleted" });
  } catch (err) {
    console.error("[Admin API Commands] Error deleting command:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error deleting command." },
      { status: 500 }
    );
  }
}

