import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getServerSupabase } from "../supabase";
import type { CommandMetadata, CommandRecord, PublicCommand, AdminCommand, CommandStats } from "./types";

// In Vercel serverless environments, process.cwd() is read-only.
// Use /tmp/.data on Vercel or process.cwd()/.data locally.
const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", ".data")
  : path.join(process.cwd(), ".data");

const COMMANDS_FILE = path.join(DATA_DIR, "commands.json");

interface LocalStore {
  commands: CommandRecord[];
}

function ensureLocalStore(): LocalStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(COMMANDS_FILE)) {
      const initial: LocalStore = { commands: [] };
      fs.writeFileSync(COMMANDS_FILE, JSON.stringify(initial, null, 2), "utf-8");
      return initial;
    }
    const raw = fs.readFileSync(COMMANDS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.warn("[Commands DB] Failed to read local commands store:", err);
    return { commands: [] };
  }
}

function saveLocalStore(store: LocalStore): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(COMMANDS_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.warn("[Commands DB] Failed to persist local commands store:", err);
  }
}

type StorageMode = "supabase_commands" | "supabase_feedbacks" | "local_store";
let activeStorageMode: StorageMode | null = null;

async function resolveStorageMode(): Promise<StorageMode> {
  if (activeStorageMode !== null) return activeStorageMode;

  try {
    const sb = getServerSupabase();
    // 1. Try commands table
    const { error: cmdErr } = await sb.from("commands").select("id").limit(1);
    if (!cmdErr) {
      activeStorageMode = "supabase_commands";
      return "supabase_commands";
    }

    // 2. Try feedbacks table (authoritative fallback in Supabase)
    const { error: fbErr } = await sb.from("feedbacks").select("id").limit(1);
    if (!fbErr) {
      activeStorageMode = "supabase_feedbacks";
      return "supabase_feedbacks";
    }
  } catch (err) {
    console.warn("[Commands DB] Supabase connectivity check failed, using local store:", err);
  }

  activeStorageMode = "local_store";
  return "local_store";
}

/**
 * Parses a feedback row into a unified CommandRecord.
 * Handles both legacy feedback text and rich JSON-encoded command payloads.
 */
function parseFeedbackRowToCommand(row: any): CommandRecord {
  const rowId = String(row.id);
  const createdAt = row.created_at || new Date().toISOString();
  const rawContent = String(row.testimonial || "");

  try {
    if (rawContent.startsWith("{") && rawContent.endsWith("}")) {
      const parsed = JSON.parse(rawContent);
      if (parsed && typeof parsed.command === "string") {
        return {
          id: String(parsed.id || rowId),
          title: parsed.title || undefined,
          command: parsed.command,
          description: parsed.description || undefined,
          category: parsed.category || "General",
          author_name: parsed.author_name || row.name || "Developer",
          is_hidden: Boolean(parsed.is_hidden),
          is_deleted: Boolean(parsed.is_deleted),
          created_at: parsed.created_at || createdAt,
          updated_at: parsed.updated_at || createdAt,
          metadata: parsed.metadata || undefined,
        };
      }
    }
  } catch {}

  // Plain legacy feedback fallback
  return {
    id: rowId,
    command: rawContent,
    author_name: row.name || "Community Member",
    category: "General",
    is_hidden: false,
    is_deleted: false,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

export async function getPublicCommands(): Promise<PublicCommand[]> {
  const mode = await resolveStorageMode();

  if (mode === "supabase_commands") {
    try {
      const sb = getServerSupabase();
      const { data, error } = await sb
        .from("commands")
        .select("id, title, command, description, category, author_name, created_at")
        .eq("is_hidden", false)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (!error && data) {
        return data as PublicCommand[];
      }
    } catch (err) {
      console.warn("[Commands DB] Error fetching from Supabase commands:", err);
    }
  } else if (mode === "supabase_feedbacks") {
    try {
      const sb = getServerSupabase();
      const { data, error } = await sb
        .from("feedbacks")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        const records = data
          .map(parseFeedbackRowToCommand)
          .filter((c) => !c.is_hidden && !c.is_deleted)
          .map((c) => ({
            id: c.id,
            title: c.title,
            command: c.command,
            description: c.description,
            category: c.category,
            author_name: c.author_name,
            created_at: c.created_at,
          }));
        return records;
      }
    } catch (err) {
      console.warn("[Commands DB] Error fetching from Supabase feedbacks:", err);
    }
  }

  // Fallback to local store
  const store = ensureLocalStore();
  return store.commands
    .filter((c) => !c.is_hidden && !c.is_deleted)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((c) => ({
      id: c.id,
      title: c.title,
      command: c.command,
      description: c.description,
      category: c.category,
      author_name: c.author_name,
      created_at: c.created_at,
    }));
}

export async function getAllCommandsForAdmin(): Promise<AdminCommand[]> {
  const mode = await resolveStorageMode();

  if (mode === "supabase_commands") {
    try {
      const sb = getServerSupabase();
      const { data, error } = await sb
        .from("commands")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        return data as AdminCommand[];
      }
    } catch (err) {
      console.warn("[Commands DB] Error fetching admin commands from Supabase:", err);
    }
  } else if (mode === "supabase_feedbacks") {
    try {
      const sb = getServerSupabase();
      const { data, error } = await sb
        .from("feedbacks")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        return data.map(parseFeedbackRowToCommand) as AdminCommand[];
      }
    } catch (err) {
      console.warn("[Commands DB] Error fetching admin feedbacks from Supabase:", err);
    }
  }

  // Fallback to local store
  const store = ensureLocalStore();
  return [...store.commands].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function createCommand(
  data: {
    command: string;
    author_name: string;
    title?: string;
    description?: string;
    category?: string;
  },
  metadata?: CommandMetadata
): Promise<CommandRecord> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const newRecord: CommandRecord = {
    id,
    title: data.title?.trim() || undefined,
    command: data.command.trim(),
    description: data.description?.trim() || undefined,
    category: data.category?.trim() || "General",
    author_name: data.author_name.trim(),
    is_hidden: false,
    is_deleted: false,
    created_at: now,
    updated_at: now,
    metadata,
  };

  const mode = await resolveStorageMode();

  if (mode === "supabase_commands") {
    try {
      const sb = getServerSupabase();
      const { error } = await sb.from("commands").insert([
        {
          id: newRecord.id,
          title: newRecord.title,
          command: newRecord.command,
          description: newRecord.description,
          category: newRecord.category,
          author_name: newRecord.author_name,
          is_hidden: false,
          is_deleted: false,
          created_at: newRecord.created_at,
          updated_at: newRecord.updated_at,
          metadata: newRecord.metadata,
        },
      ]);
      if (!error) {
        const store = ensureLocalStore();
        store.commands.unshift(newRecord);
        saveLocalStore(store);
        return newRecord;
      }
    } catch (err) {
      console.warn("[Commands DB] Supabase commands insert exception:", err);
    }
  } else if (mode === "supabase_feedbacks") {
    try {
      const sb = getServerSupabase();
      // Store rich JSON in testimonial column of feedbacks table
      const payloadString = JSON.stringify(newRecord);
      const { data: fbData, error } = await sb.from("feedbacks").insert([
        {
          name: newRecord.author_name,
          testimonial: payloadString,
          created_at: newRecord.created_at,
        },
      ]).select();

      if (!error && fbData && fbData[0]) {
        // Also sync local store replica
        const store = ensureLocalStore();
        store.commands.unshift(newRecord);
        saveLocalStore(store);
        return newRecord;
      }
      console.warn("[Commands DB] Supabase feedbacks insert error:", error);
    } catch (err) {
      console.warn("[Commands DB] Supabase feedbacks exception:", err);
    }
  }

  // Fallback to local store
  const store = ensureLocalStore();
  store.commands.unshift(newRecord);
  saveLocalStore(store);
  return newRecord;
}

export async function setCommandVisibility(id: string, is_hidden: boolean): Promise<boolean> {
  const now = new Date().toISOString();
  let updated = false;
  const mode = await resolveStorageMode();

  if (mode === "supabase_commands") {
    try {
      const sb = getServerSupabase();
      const { error } = await sb
        .from("commands")
        .update({ is_hidden, updated_at: now })
        .eq("id", id);
      if (!error) updated = true;
    } catch (err) {
      console.warn("[Commands DB] Supabase commands visibility update error:", err);
    }
  } else if (mode === "supabase_feedbacks") {
    try {
      const sb = getServerSupabase();
      const { data: rows } = await sb.from("feedbacks").select("*");
      if (rows) {
        for (const row of rows) {
          const cmd = parseFeedbackRowToCommand(row);
          if (cmd.id === id || String(row.id) === id) {
            cmd.is_hidden = is_hidden;
            cmd.updated_at = now;
            const updatedPayload = JSON.stringify(cmd);
            const { error: updErr } = await sb
              .from("feedbacks")
              .update({ testimonial: updatedPayload })
              .eq("id", row.id);
            if (!updErr) updated = true;
            break;
          }
        }
      }
    } catch (err) {
      console.warn("[Commands DB] Supabase feedbacks visibility error:", err);
    }
  }

  const store = ensureLocalStore();
  const idx = store.commands.findIndex((c) => c.id === id);
  if (idx !== -1) {
    store.commands[idx].is_hidden = is_hidden;
    store.commands[idx].updated_at = now;
    saveLocalStore(store);
    updated = true;
  }

  return updated;
}

export async function deleteCommand(id: string): Promise<boolean> {
  const now = new Date().toISOString();
  let updated = false;
  const mode = await resolveStorageMode();

  if (mode === "supabase_commands") {
    try {
      const sb = getServerSupabase();
      const { error } = await sb
        .from("commands")
        .update({ is_deleted: true, updated_at: now })
        .eq("id", id);
      if (!error) updated = true;
    } catch (err) {
      console.warn("[Commands DB] Supabase commands soft delete error:", err);
    }
  } else if (mode === "supabase_feedbacks") {
    try {
      const sb = getServerSupabase();
      const { data: rows } = await sb.from("feedbacks").select("*");
      if (rows) {
        for (const row of rows) {
          const cmd = parseFeedbackRowToCommand(row);
          if (cmd.id === id || String(row.id) === id) {
            cmd.is_deleted = true;
            cmd.updated_at = now;
            const updatedPayload = JSON.stringify(cmd);
            const { error: updErr } = await sb
              .from("feedbacks")
              .update({ testimonial: updatedPayload })
              .eq("id", row.id);
            if (!updErr) updated = true;
            break;
          }
        }
      }
    } catch (err) {
      console.warn("[Commands DB] Supabase feedbacks delete error:", err);
    }
  }

  const store = ensureLocalStore();
  const idx = store.commands.findIndex((c) => c.id === id);
  if (idx !== -1) {
    store.commands[idx].is_deleted = true;
    store.commands[idx].updated_at = now;
    saveLocalStore(store);
    updated = true;
  }

  return updated;
}

export async function getCommandStats(): Promise<CommandStats> {
  const all = await getAllCommandsForAdmin();
  const total = all.length;
  const deleted = all.filter((c) => c.is_deleted).length;
  const nonDeleted = all.filter((c) => !c.is_deleted);
  const hidden = nonDeleted.filter((c) => c.is_hidden).length;
  const visible = nonDeleted.filter((c) => !c.is_hidden).length;

  return {
    total,
    visible,
    hidden,
    deleted,
  };
}
