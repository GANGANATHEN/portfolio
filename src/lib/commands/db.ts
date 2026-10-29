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

let isSupabaseCommandsTableReady: boolean | null = null;

async function checkSupabaseCommandsTable(): Promise<boolean> {
  if (isSupabaseCommandsTableReady !== null) return isSupabaseCommandsTableReady;
  try {
    const sb = getServerSupabase();
    const { error } = await sb.from("commands").select("id").limit(1);
    if (!error) {
      isSupabaseCommandsTableReady = true;
      return true;
    }
    isSupabaseCommandsTableReady = false;
    return false;
  } catch {
    isSupabaseCommandsTableReady = false;
    return false;
  }
}

export async function getPublicCommands(): Promise<PublicCommand[]> {
  const isSupabaseReady = await checkSupabaseCommandsTable();
  if (isSupabaseReady) {
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
      console.warn("[Commands DB] Error fetching from Supabase commands table:", err);
    }
  }

  // Fallback to local store
  const store = ensureLocalStore();
  const visible = store.commands
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

  return visible;
}

export async function getAllCommandsForAdmin(): Promise<AdminCommand[]> {
  const isSupabaseReady = await checkSupabaseCommandsTable();
  if (isSupabaseReady) {
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

  const isSupabaseReady = await checkSupabaseCommandsTable();
  if (isSupabaseReady) {
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
        // Also sync local store as replica
        const store = ensureLocalStore();
        store.commands.unshift(newRecord);
        saveLocalStore(store);
        return newRecord;
      }
      console.warn("[Commands DB] Supabase insert failed, persisting to durable fallback:", error);
    } catch (err) {
      console.warn("[Commands DB] Supabase exception during createCommand:", err);
    }
  }

  // Save to durable store
  const store = ensureLocalStore();
  store.commands.unshift(newRecord);
  saveLocalStore(store);
  return newRecord;
}

export async function setCommandVisibility(id: string, is_hidden: boolean): Promise<boolean> {
  const now = new Date().toISOString();
  let updated = false;

  const isSupabaseReady = await checkSupabaseCommandsTable();
  if (isSupabaseReady) {
    try {
      const sb = getServerSupabase();
      const { error } = await sb
        .from("commands")
        .update({ is_hidden, updated_at: now })
        .eq("id", id);
      if (!error) updated = true;
    } catch (err) {
      console.warn("[Commands DB] Supabase visibility update error:", err);
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

  const isSupabaseReady = await checkSupabaseCommandsTable();
  if (isSupabaseReady) {
    try {
      const sb = getServerSupabase();
      const { error } = await sb
        .from("commands")
        .update({ is_deleted: true, updated_at: now })
        .eq("id", id);
      if (!error) updated = true;
    } catch (err) {
      console.warn("[Commands DB] Supabase soft delete error:", err);
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
