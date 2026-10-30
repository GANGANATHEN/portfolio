import type {
  Conversation,
  ChatMessage,
  NotificationLog,
  EmailOtpRecord,
  ChatAttachment,
} from "./types";
import { getServerSupabase } from "../supabase";
import crypto from "crypto";
import fs from "fs";
import path from "path";

// Durable local storage path for persistent offline & dev execution
const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", ".data")
  : path.join(/*turbopackIgnore: true*/ process.cwd(), ".data");
const STORE_FILE = path.join(/*turbopackIgnore: true*/ DATA_DIR, "live-chat-store.json");
export const ATTACHMENTS_DIR = path.join(/*turbopackIgnore: true*/ DATA_DIR, "attachments");

interface PersistentStore {
  conversations: Record<string, Conversation>; // id -> Conversation
  hashToId: Record<string, string>; // sessionTokenHash -> conversationId
  messages: Record<string, ChatMessage[]>; // conversationId -> ChatMessage[]
  notificationLogs: NotificationLog[];
  emailOtps: Record<string, EmailOtpRecord[]>; // conversationId -> EmailOtpRecord[]
  attachments: Record<string, ChatAttachment>; // attachmentId -> ChatAttachment
}

// In-memory cache synced with disk
let localStore: PersistentStore = {
  conversations: {},
  hashToId: {},
  messages: {},
  notificationLogs: [],
  emailOtps: {},
  attachments: {},
};

// Simple in-process mutex to prevent concurrent write races in node
let storeMutex = Promise.resolve();
function runWithLock<T>(fn: () => Promise<T> | T): Promise<T> {
  const next = storeMutex.then(fn);
  storeMutex = next.then(() => {}).catch(() => {});
  return next;
}

// Load durable store from disk on startup
function initDurableStore(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(ATTACHMENTS_DIR)) {
      fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_FILE)) {
      const content = fs.readFileSync(STORE_FILE, "utf-8");
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === "object") {
        localStore = {
          conversations: parsed.conversations || {},
          hashToId: parsed.hashToId || {},
          messages: parsed.messages || {},
          notificationLogs: parsed.notificationLogs || [],
          emailOtps: parsed.emailOtps || {},
          attachments: parsed.attachments || {},
        };
      }
    }
  } catch (err) {
    console.warn("[Live Chat DB] Could not read local persistent store:", err);
  }
}
initDurableStore();

function persistStoreToDisk(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempFile = `${STORE_FILE}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
    fs.writeFileSync(tempFile, JSON.stringify(localStore, null, 2), "utf-8");
    fs.renameSync(tempFile, STORE_FILE);
  } catch (err) {
    console.warn("[Live Chat DB] Could not write local persistent store to disk:", err);
  }
}

// Track Supabase table status
let supabaseTablesAvailable: boolean | null = null;
let lastSupabaseCheckTime = 0;

export class DatabaseUnavailableError extends Error {
  public code = "DATABASE_UNAVAILABLE";
  constructor(message = "Database service is temporarily unavailable.") {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

function shouldEnforceProductionPersistence(): boolean {
  return process.env.VERCEL === "1" || process.env.REQUIRE_SUPABASE === "true";
}

/**
 * Check if Supabase Postgres is ready.
 * On Vercel (or when REQUIRE_SUPABASE=true), fails visibly and throws an error if Supabase is unreachable,
 * strictly preventing silent fallback to ephemeral storage in production on Vercel.
 */
async function checkSupabaseAvailable(): Promise<boolean> {
  const isVercelProduction = shouldEnforceProductionPersistence();
  const now = Date.now();

  if (supabaseTablesAvailable === true) return true;
  if (supabaseTablesAvailable === false && now - lastSupabaseCheckTime < 15000) {
    if (isVercelProduction) {
      throw new DatabaseUnavailableError(
        "[Production Database Error] Supabase tables are unavailable in production on Vercel. Ephemeral fallback is strictly disabled.",
      );
    }
    return false;
  }

  lastSupabaseCheckTime = now;
  try {
    const serverClient = getServerSupabase();
    const { error } = await serverClient.from("chat_conversations").select("id").limit(1);
    supabaseTablesAvailable = !error;
    if (error) {
      if (isVercelProduction) {
        throw new DatabaseUnavailableError(
          `[Production Database Error] Supabase 'chat_conversations' query failed on Vercel: ${error.message}. Run migrations and verify credentials in Vercel.`,
        );
      }
      console.warn(
        "[Live Chat DB] Supabase table 'chat_conversations' not ready. Using durable storage adapter. Error:",
        error.message,
      );
    } else {
      console.log("[Live Chat DB] Supabase connected successfully for Live Chat.");
    }
  } catch (err: unknown) {
    supabaseTablesAvailable = false;
    if (err instanceof DatabaseUnavailableError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (isVercelProduction) {
      throw new DatabaseUnavailableError(
        `[Production Database Error] Could not connect to Supabase on Vercel: ${msg}. Configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.`,
      );
    }
  }
  return Boolean(supabaseTablesAvailable);
}

function mapSupabaseConversation(data: Record<string, unknown>): Conversation {
  return {
    id: String(data.id),
    sessionTokenHash: String(data.session_token_hash),
    visitorName: String(data.visitor_name || "Visitor"),
    visitorEmail: data.visitor_email ? String(data.visitor_email) : null,
    emailVerified: Boolean(data.email_verified),
    emailNotificationsEnabled: Boolean(data.email_notifications_enabled),
    createdAt: String(data.created_at),
    updatedAt: String(data.updated_at),
    lastMessageAt: String(data.last_message_at),
    unreadOwnerCount: Number(data.unread_owner_count || 0),
    unreadVisitorCount: Number(data.unread_visitor_count || 0),
    lastOwnerNotificationAt: data.last_owner_notification_at ? String(data.last_owner_notification_at) : null,
    lastVisitorNotificationAt: data.last_visitor_notification_at ? String(data.last_visitor_notification_at) : null,
    isArchived: Boolean(data.is_archived),
    isDeleted: Boolean(data.is_deleted),
    isPinned: Boolean(data.is_pinned),
    pinnedAt: data.pinned_at ? String(data.pinned_at) : null,
  };
}

export async function getOrCreateConversationByHash(
  sessionTokenHash: string,
  defaultName = "Visitor",
): Promise<Conversation> {
  const isSupabaseReady = await checkSupabaseAvailable();

  if (isSupabaseReady) {
    try {
      const serverClient = getServerSupabase();
      const { data, error } = await serverClient
        .from("chat_conversations")
        .select("*")
        .eq("session_token_hash", sessionTokenHash)
        .eq("is_deleted", false)
        .maybeSingle();

      if (data && !error) {
        return mapSupabaseConversation(data);
      }

      // Insert new conversation
      const newId = crypto.randomUUID();
      const newConv = {
        id: newId,
        session_token_hash: sessionTokenHash,
        visitor_name: defaultName,
        email_verified: false,
        email_notifications_enabled: false,
        unread_owner_count: 0,
        unread_visitor_count: 0,
        last_message_at: new Date().toISOString(),
        is_archived: false,
        is_deleted: false,
      };

      const { data: inserted, error: insertError } = await serverClient
        .from("chat_conversations")
        .insert([newConv])
        .select()
        .single();

      if (inserted && !insertError) {
        return mapSupabaseConversation(inserted);
      }
    } catch (e) {
      if (shouldEnforceProductionPersistence()) {
        throw e;
      }
      console.warn("[Live Chat DB] Error creating conversation in Supabase, using durable storage:", e);
    }
  }

  // Durable store fallback for dev/test
  return runWithLock(() => {
    const existingId = localStore.hashToId[sessionTokenHash];
    if (existingId && localStore.conversations[existingId] && !localStore.conversations[existingId].isDeleted) {
      return localStore.conversations[existingId];
    }

    const newId = crypto.randomUUID();
    const now = new Date().toISOString();
    const conv: Conversation = {
      id: newId,
      sessionTokenHash,
      visitorName: defaultName,
      visitorEmail: null,
      emailVerified: false,
      emailNotificationsEnabled: false,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      unreadOwnerCount: 0,
      unreadVisitorCount: 0,
      isArchived: false,
      isDeleted: false,
      isPinned: false,
      pinnedAt: null,
    };

    localStore.conversations[newId] = conv;
    localStore.hashToId[sessionTokenHash] = newId;
    localStore.messages[newId] = [];
    localStore.emailOtps[newId] = [];
    persistStoreToDisk();

    return conv;
  });
}

export async function getConversationByHash(sessionTokenHash: string): Promise<Conversation | null> {
  const isSupabaseReady = await checkSupabaseAvailable();

  if (isSupabaseReady) {
    try {
      const serverClient = getServerSupabase();
      const { data, error } = await serverClient
        .from("chat_conversations")
        .select("*")
        .eq("session_token_hash", sessionTokenHash)
        .eq("is_deleted", false)
        .maybeSingle();

      if (data && !error) {
        return mapSupabaseConversation(data);
      }
    } catch (e) {
      if (shouldEnforceProductionPersistence()) throw e;
    }
  }

  const id = localStore.hashToId[sessionTokenHash];
  const c = id ? localStore.conversations[id] : null;
  return c && !c.isDeleted ? c : null;
}

export async function getConversationById(id: string): Promise<Conversation | null> {
  const isSupabaseReady = await checkSupabaseAvailable();

  if (isSupabaseReady) {
    try {
      const serverClient = getServerSupabase();
      const { data, error } = await serverClient
        .from("chat_conversations")
        .select("*")
        .eq("id", id)
        .eq("is_deleted", false)
        .maybeSingle();

      if (data && !error) {
        return mapSupabaseConversation(data);
      }
    } catch (e) {
      if (shouldEnforceProductionPersistence()) throw e;
    }
  }

  const c = localStore.conversations[id];
  return c && !c.isDeleted ? c : null;
}

/**
 * Update visitor profile.
 * CRITICAL REQUIREMENT: If visitor changes their email address, emailVerified MUST be reset to false!
 */
export async function updateConversationProfile(
  sessionTokenHash: string,
  profile: {
    visitorName?: string;
    visitorEmail?: string | null;
    emailNotificationsEnabled?: boolean;
    emailVerified?: boolean;
  },
): Promise<Conversation | null> {
  const conv = await getConversationByHash(sessionTokenHash);
  if (!conv) return null;

  const updatedName = profile.visitorName !== undefined ? profile.visitorName.trim() : conv.visitorName;
  const updatedEmail = profile.visitorEmail !== undefined ? profile.visitorEmail : conv.visitorEmail;
  const updatedNotify =
    profile.emailNotificationsEnabled !== undefined
      ? profile.emailNotificationsEnabled
      : conv.emailNotificationsEnabled;

  let updatedVerified = conv.emailVerified;
  const normalizedOld = conv.visitorEmail?.trim().toLowerCase() || null;
  const normalizedNew = updatedEmail?.trim().toLowerCase() || null;

  if (normalizedNew !== normalizedOld) {
    updatedVerified = false; // Reset verification on email change
  } else if (profile.emailVerified !== undefined) {
    updatedVerified = profile.emailVerified;
  }

  const now = new Date().toISOString();

  const isSupabaseReady = await checkSupabaseAvailable();
  if (isSupabaseReady) {
    try {
      const serverClient = getServerSupabase();
      await serverClient
        .from("chat_conversations")
        .update({
          visitor_name: updatedName,
          visitor_email: updatedEmail,
          email_verified: updatedVerified,
          email_notifications_enabled: updatedNotify,
          updated_at: now,
        })
        .eq("id", conv.id);

      return {
        ...conv,
        visitorName: updatedName,
        visitorEmail: updatedEmail,
        emailVerified: updatedVerified,
        emailNotificationsEnabled: updatedNotify,
        updatedAt: now,
      };
    } catch (e) {
      if (shouldEnforceProductionPersistence()) throw e;
    }
  }

  return runWithLock(() => {
    const target = localStore.conversations[conv.id];
    if (target) {
      target.visitorName = updatedName;
      target.visitorEmail = updatedEmail;
      target.emailVerified = updatedVerified;
      target.emailNotificationsEnabled = updatedNotify;
      target.updatedAt = now;
      localStore.conversations[conv.id] = target;
      persistStoreToDisk();
      return target;
    }
    return null;
  });
}

/**
 * Mark a conversation's email address as verified
 */
export async function setConversationEmailVerified(
  conversationId: string,
  verifiedEmail: string,
): Promise<Conversation | null> {
  const now = new Date().toISOString();
  const normalized = verifiedEmail.trim().toLowerCase();

  const isSupabaseReady = await checkSupabaseAvailable();
  if (isSupabaseReady) {
    try {
      const serverClient = getServerSupabase();
      const { data, error } = await serverClient
        .from("chat_conversations")
        .update({
          visitor_email: normalized,
          email_verified: true,
          email_notifications_enabled: true,
          updated_at: now,
        })
        .eq("id", conversationId)
        .select()
        .single();

      if (data && !error) {
        return mapSupabaseConversation(data);
      }
    } catch (e) {
      if (shouldEnforceProductionPersistence()) throw e;
    }
  }

  return runWithLock(() => {
    const conv = localStore.conversations[conversationId];
    if (conv) {
      conv.visitorEmail = normalized;
      conv.emailVerified = true;
      conv.emailNotificationsEnabled = true;
      conv.updatedAt = now;
      localStore.conversations[conversationId] = conv;
      persistStoreToDisk();
      return conv;
    }
    return null;
  });
}

/**
 * Find existing verified conversation for an email
 */
export async function findConversationByVerifiedEmail(email: string): Promise<Conversation | null> {
  const normalized = email.trim().toLowerCase();
  const isSupabaseReady = await checkSupabaseAvailable();

  if (isSupabaseReady) {
    try {
      const serverClient = getServerSupabase();
      const { data, error } = await serverClient
        .from("chat_conversations")
        .select("*")
        .eq("visitor_email", normalized)
        .eq("email_verified", true)
        .eq("is_deleted", false)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && !error) {
        return mapSupabaseConversation(data);
      }
    } catch (e) {
      if (shouldEnforceProductionPersistence()) throw e;
    }
  }

  // Local durable store fallback
  let candidate: Conversation | null = null;
  for (const conv of Object.values(localStore.conversations)) {
    if (
      conv.visitorEmail?.trim().toLowerCase() === normalized &&
      conv.emailVerified &&
      !conv.isDeleted
    ) {
      if (!candidate || new Date(conv.lastMessageAt).getTime() > new Date(candidate.lastMessageAt).getTime()) {
        candidate = conv;
      }
    }
  }
  return candidate;
}

/**
 * Associate active session with verified email and restore existing conversation history if returning user.
 * Merges any anonymous messages sent in current session into the verified conversation.
 */
export async function associateConversationWithVerifiedEmail(
  currentConversationId: string,
  currentSessionTokenHash: string,
  email: string,
): Promise<{ conversation: Conversation; isRestored: boolean }> {
  const now = new Date().toISOString();
  const normalized = email.trim().toLowerCase();

  const isSupabaseReady = await checkSupabaseAvailable();
  if (isSupabaseReady) {
    try {
      const serverClient = getServerSupabase();

      // Find existing verified conversation for this email (excluding current conversation)
      const { data: existingConvs } = await serverClient
        .from("chat_conversations")
        .select("*")
        .eq("visitor_email", normalized)
        .eq("email_verified", true)
        .eq("is_deleted", false)
        .neq("id", currentConversationId)
        .order("last_message_at", { ascending: false })
        .limit(1);

      const canonicalConv = existingConvs && existingConvs.length > 0 ? existingConvs[0] : null;

      if (!canonicalConv) {
        // No previous verified conversation -> mark current conversation verified
        const { data: updated, error: updateError } = await serverClient
          .from("chat_conversations")
          .update({
            visitor_email: normalized,
            email_verified: true,
            email_notifications_enabled: true,
            updated_at: now,
          })
          .eq("id", currentConversationId)
          .select()
          .single();

        if (updated && !updateError) {
          const conv = mapSupabaseConversation(updated);
          runWithLock(() => {
            const loc = localStore.conversations[currentConversationId];
            if (loc) {
              loc.visitorEmail = normalized;
              loc.emailVerified = true;
              loc.emailNotificationsEnabled = true;
              loc.updatedAt = now;
              persistStoreToDisk();
            }
          });
          return { conversation: conv, isRestored: false };
        }
      } else {
        // Existing verified conversation found!
        // 1. Check if current conversation has messages or attachments to migrate
        const { data: currentMsgs } = await serverClient
          .from("chat_messages")
          .select("id")
          .eq("conversation_id", currentConversationId);

        const hasMessages = Array.isArray(currentMsgs) && currentMsgs.length > 0;

        if (hasMessages) {
          // Migrate messages to canonical conversation
          await serverClient
            .from("chat_messages")
            .update({ conversation_id: canonicalConv.id })
            .eq("conversation_id", currentConversationId);

          // Migrate attachments
          await serverClient
            .from("chat_attachments")
            .update({ conversation_id: canonicalConv.id })
            .eq("conversation_id", currentConversationId);
        }

        // Migrate any OTP verification records
        await serverClient
          .from("chat_email_otps")
          .update({ conversation_id: canonicalConv.id })
          .eq("conversation_id", currentConversationId);

        // 2. Safely delete the temporary conversation row (freeing up currentSessionTokenHash)
        await serverClient
          .from("chat_conversations")
          .delete()
          .eq("id", currentConversationId);

        // 3. Attach currentSessionTokenHash to canonical conversation
        const updatePayload: Record<string, unknown> = {
          session_token_hash: currentSessionTokenHash,
          visitor_email: normalized,
          email_verified: true,
          email_notifications_enabled: true,
          updated_at: now,
        };
        if (hasMessages) {
          updatePayload.last_message_at = now;
        }

        const { data: restoredConv, error: linkError } = await serverClient
          .from("chat_conversations")
          .update(updatePayload)
          .eq("id", canonicalConv.id)
          .select()
          .single();

        if (restoredConv && !linkError) {
          const mapped = mapSupabaseConversation(restoredConv);

          // Update localStore cache in lock
          runWithLock(() => {
            const tempMsgs = localStore.messages[currentConversationId] || [];
            if (tempMsgs.length > 0) {
              const existingMsgs = localStore.messages[canonicalConv.id] || [];
              localStore.messages[canonicalConv.id] = [
                ...existingMsgs,
                ...tempMsgs.map((m) => ({ ...m, conversationId: canonicalConv.id })),
              ];
            }
            delete localStore.messages[currentConversationId];
            delete localStore.conversations[currentConversationId];
            delete localStore.emailOtps[currentConversationId];
            delete localStore.hashToId[canonicalConv.session_token_hash];

            localStore.hashToId[currentSessionTokenHash] = canonicalConv.id;
            localStore.conversations[canonicalConv.id] = mapped;
            persistStoreToDisk();
          });

          return { conversation: mapped, isRestored: true };
        }
      }
    } catch (e) {
      if (shouldEnforceProductionPersistence()) throw e;
      console.warn("[Live Chat DB] Error linking conversation in Supabase, using durable storage:", e);
    }
  }

  // Durable store fallback
  return runWithLock(() => {
    let canonicalConv: Conversation | null = null;
    for (const conv of Object.values(localStore.conversations)) {
      if (
        conv.id !== currentConversationId &&
        conv.visitorEmail?.trim().toLowerCase() === normalized &&
        conv.emailVerified &&
        !conv.isDeleted
      ) {
        if (!canonicalConv || new Date(conv.lastMessageAt).getTime() > new Date(canonicalConv.lastMessageAt).getTime()) {
          canonicalConv = conv;
        }
      }
    }

    if (!canonicalConv) {
      const current = localStore.conversations[currentConversationId];
      if (current) {
        current.visitorEmail = normalized;
        current.emailVerified = true;
        current.emailNotificationsEnabled = true;
        current.updatedAt = now;
        localStore.conversations[currentConversationId] = current;
        persistStoreToDisk();
        return { conversation: current, isRestored: false };
      }
      throw new Error("Conversation not found");
    }

    // Merge messages from currentConversationId into canonicalConv
    const currentMsgs = localStore.messages[currentConversationId] || [];
    const hasMessages = currentMsgs.length > 0;
    if (hasMessages) {
      const targetMsgs = localStore.messages[canonicalConv.id] || [];
      localStore.messages[canonicalConv.id] = [
        ...targetMsgs,
        ...currentMsgs.map((m) => ({ ...m, conversationId: canonicalConv!.id })),
      ];
      canonicalConv.lastMessageAt = now;
    }

    // Migrate attachments
    for (const att of Object.values(localStore.attachments)) {
      if (att.conversationId === currentConversationId) {
        att.conversationId = canonicalConv.id;
      }
    }

    // Clean up temporary conversation
    delete localStore.messages[currentConversationId];
    delete localStore.conversations[currentConversationId];
    delete localStore.emailOtps[currentConversationId];
    delete localStore.hashToId[canonicalConv.sessionTokenHash];

    // Link new session hash to canonical conversation
    canonicalConv.sessionTokenHash = currentSessionTokenHash;
    canonicalConv.visitorEmail = normalized;
    canonicalConv.emailVerified = true;
    canonicalConv.emailNotificationsEnabled = true;
    canonicalConv.updatedAt = now;

    localStore.hashToId[currentSessionTokenHash] = canonicalConv.id;
    localStore.conversations[canonicalConv.id] = canonicalConv;
    persistStoreToDisk();

    return { conversation: canonicalConv, isRestored: true };
  });
}

// ==============================================================================
// OTP STORAGE & VERIFICATION METHODS
// ==============================================================================

export async function createEmailOtp(
  conversationId: string,
  email: string,
  otpHash: string,
  expiresAt: string,
  maxAttempts = 5,
): Promise<EmailOtpRecord> {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const normalized = email.trim().toLowerCase();

  const record: EmailOtpRecord = {
    id,
    conversationId,
    email: normalized,
    otpHash,
    attempts: 0,
    maxAttempts,
    createdAt,
    expiresAt,
    usedAt: null,
  };

  const isSupabaseReady = await checkSupabaseAvailable();
  if (isSupabaseReady) {
    try {
      const serverClient = getServerSupabase();
      const { error } = await serverClient.from("chat_email_otps").insert([
        {
          id: record.id,
          conversation_id: record.conversationId,
          email: record.email,
          otp_hash: record.otpHash,
          attempts: record.attempts,
          max_attempts: record.maxAttempts,
          created_at: record.createdAt,
          expires_at: record.expiresAt,
          used_at: null,
        },
      ]);
      if (!error) {
        return record;
      }
      if (shouldEnforceProductionPersistence()) {
        throw new DatabaseUnavailableError(`Supabase chat_email_otps insert failed: ${error.message}`);
      }
    } catch (e) {
      if (shouldEnforceProductionPersistence()) throw e;
    }
  }

  return runWithLock(() => {
    const list = localStore.emailOtps[conversationId] || [];
    list.push(record);
    localStore.emailOtps[conversationId] = list;
    persistStoreToDisk();
    return record;
  });
}

export async function getLatestEmailOtp(
  conversationId: string,
  email: string,
): Promise<EmailOtpRecord | null> {
  const normalized = email.trim().toLowerCase();
  const isSupabaseReady = await checkSupabaseAvailable();

  if (isSupabaseReady) {
    try {
      const serverClient = getServerSupabase();
      const { data, error } = await serverClient
        .from("chat_email_otps")
        .select("*")
        .eq("conversation_id", conversationId)
        .eq("email", normalized)
        .is("used_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && !error) {
        return {
          id: data.id,
          conversationId: data.conversation_id,
          email: data.email,
          otpHash: data.otp_hash,
          attempts: data.attempts,
          maxAttempts: data.max_attempts,
          createdAt: data.created_at,
          expiresAt: data.expires_at,
          usedAt: data.used_at,
        };
      }

      if (!error) {
        return null;
      }

      if (shouldEnforceProductionPersistence()) {
        throw new DatabaseUnavailableError(`Supabase chat_email_otps query failed: ${error.message}`);
      }
    } catch (e) {
      if (shouldEnforceProductionPersistence()) throw e;
    }
  }

  const list = localStore.emailOtps[conversationId] || [];
  const valid = list
    .filter((o) => o.email === normalized && !o.usedAt)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return valid[0] || null;
}

export async function incrementOtpAttempts(otpId: string): Promise<number> {
  const isSupabaseReady = await checkSupabaseAvailable();

  if (isSupabaseReady) {
    try {
      const serverClient = getServerSupabase();
      const { data: current } = await serverClient
        .from("chat_email_otps")
        .select("attempts")
        .eq("id", otpId)
        .single();

      const newAttempts = (current?.attempts || 0) + 1;
      const { error } = await serverClient
        .from("chat_email_otps")
        .update({ attempts: newAttempts })
        .eq("id", otpId);

      if (!error) {
        return newAttempts;
      }
      if (shouldEnforceProductionPersistence()) {
        throw new DatabaseUnavailableError(`Supabase incrementOtpAttempts failed: ${error.message}`);
      }
    } catch (e) {
      if (shouldEnforceProductionPersistence()) throw e;
    }
  }

  return runWithLock(() => {
    for (const list of Object.values(localStore.emailOtps)) {
      const record = list.find((o) => o.id === otpId);
      if (record) {
        record.attempts += 1;
        persistStoreToDisk();
        return record.attempts;
      }
    }
    return 1;
  });
}

export async function markOtpUsed(otpId: string): Promise<void> {
  const now = new Date().toISOString();
  const isSupabaseReady = await checkSupabaseAvailable();

  if (isSupabaseReady) {
    try {
      const serverClient = getServerSupabase();
      const { error } = await serverClient
        .from("chat_email_otps")
        .update({ used_at: now })
        .eq("id", otpId);
      if (!error) {
        return;
      }
      if (shouldEnforceProductionPersistence()) {
        throw new DatabaseUnavailableError(`Supabase markOtpUsed failed: ${error.message}`);
      }
    } catch (e) {
      if (shouldEnforceProductionPersistence()) throw e;
    }
  }

  runWithLock(() => {
    for (const list of Object.values(localStore.emailOtps)) {
      const record = list.find((o) => o.id === otpId);
      if (record) {
        record.usedAt = now;
        persistStoreToDisk();
        return;
      }
    }
  });
}

// ==============================================================================
// ADVANCED MESSAGES & ATTACHMENT MANAGEMENT
// ==============================================================================

export async function getMessages(
  conversationId: string,
  options?: { limit?: number; before?: string },
): Promise<ChatMessage[]> {
  const limit = Math.min(Math.max(options?.limit || 100, 1), 200);
  const before = options?.before;

  const isSupabaseReady = await checkSupabaseAvailable();

  if (isSupabaseReady) {
    try {
      const serverClient = getServerSupabase();
      let query = serverClient
        .from("chat_messages")
        .select("*, chat_attachments(*)")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (before) {
        query = query.lt("created_at", before);
      }

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (data && !error) {
        // Collect reply previews
        const messageMap = new Map<string, { id: string; senderType: "visitor" | "owner"; content: string }>();
        data.forEach((d) => {
          messageMap.set(d.id, {
            id: d.id,
            senderType: d.sender_type,
            content: d.is_deleted ? "[Message deleted]" : d.content,
          });
        });

        return data.map((d) => {
          const attachments = Array.isArray(d.chat_attachments)
            ? d.chat_attachments.map((a: Record<string, unknown>) => ({
                id: String(a.id),
                conversationId: String(a.conversation_id),
                messageId: a.message_id ? String(a.message_id) : null,
                fileName: String(a.file_name),
                fileSize: Number(a.file_size),
                mimeType: String(a.mime_type),
                storagePath: String(a.storage_path),
                createdAt: String(a.created_at),
              }))
            : [];

          const replyPreview = d.reply_to_id ? messageMap.get(d.reply_to_id) || null : null;

          return {
            id: d.id,
            conversationId: d.conversation_id,
            senderType: d.sender_type,
            content: d.is_deleted ? "[Message deleted]" : d.content,
            createdAt: d.created_at,
            readAt: d.read_at,
            isEdited: Boolean(d.is_edited),
            editedAt: d.edited_at,
            isDeleted: Boolean(d.is_deleted),
            deletedAt: d.deleted_at,
            replyToId: d.reply_to_id,
            replyPreview,
            reactions: d.reactions || {},
            attachments,
            clientMessageId: d.client_message_id,
          };
        });
      }
    } catch (e) {
      if (shouldEnforceProductionPersistence()) throw e;
    }
  }

  // Local durable store
  const all = localStore.messages[conversationId] || [];
  let filtered = all;
  if (before) {
    const beforeTime = new Date(before).getTime();
    filtered = all.filter((m) => new Date(m.createdAt).getTime() < beforeTime);
  }

  const sliced = filtered.slice(-limit);

  // Map reply previews and attachments
  const msgMap = new Map<string, { id: string; senderType: "visitor" | "owner"; content: string; snippet: string }>();
  all.forEach((m) => {
    msgMap.set(m.id, {
      id: m.id,
      senderType: m.senderType,
      content: m.isDeleted ? "[Message deleted]" : m.content,
      snippet: (m.isDeleted ? "[Message deleted]" : m.content).slice(0, 100),
    });
  });

  return sliced.map((m) => ({
    ...m,
    content: m.isDeleted ? "[Message deleted]" : m.content,
    replyPreview: m.replyToId ? msgMap.get(m.replyToId) || null : null,
  }));
}

export async function addMessage({
  conversationId,
  senderType,
  content,
  replyToId,
  attachments,
  clientMessageId,
}: {
  conversationId: string;
  senderType: "visitor" | "owner";
  content: string;
  replyToId?: string | null;
  attachments?: ChatAttachment[];
  clientMessageId?: string | null;
}): Promise<ChatMessage> {
  // Deduplication check on clientMessageId
  if (clientMessageId) {
    const existing = await findMessageByClientId(conversationId, clientMessageId);
    if (existing) {
      return existing;
    }
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  // Find referenced reply preview
  let replyPreview: ChatMessage["replyPreview"] = null;
  if (replyToId) {
    const ref = await findMessageById(conversationId, replyToId);
    if (ref) {
      replyPreview = {
        id: ref.id,
        senderType: ref.senderType,
        content: ref.isDeleted ? "[Message deleted]" : ref.content,
        snippet: (ref.isDeleted ? "[Message deleted]" : ref.content).slice(0, 100),
      };
    }
  }

  const message: ChatMessage = {
    id,
    conversationId,
    senderType,
    content,
    createdAt: now,
    readAt: null,
    isEdited: false,
    editedAt: null,
    isDeleted: false,
    deletedAt: null,
    replyToId: replyToId || null,
    replyPreview,
    reactions: {},
    attachments: attachments || [],
    clientMessageId: clientMessageId || null,
  };

  const isSupabaseReady = await checkSupabaseAvailable();
  if (isSupabaseReady) {
    try {
      const serverClient = getServerSupabase();
      await serverClient.from("chat_messages").insert([
        {
          id: message.id,
          conversation_id: message.conversationId,
          sender_type: message.senderType,
          content: message.content,
          created_at: message.createdAt,
          read_at: null,
          is_edited: false,
          edited_at: null,
          is_deleted: false,
          deleted_at: null,
          reply_to_id: message.replyToId,
          reactions: message.reactions,
          client_message_id: message.clientMessageId,
        },
      ]);

      // Link attachments to this message
      if (attachments && attachments.length > 0) {
        for (const att of attachments) {
          await serverClient
            .from("chat_attachments")
            .update({ message_id: message.id })
            .eq("id", att.id);
        }
      }

      // Update conversation timestamp and unread counters
      const conv = await getConversationById(conversationId);
      if (conv) {
        const updateData: Record<string, unknown> = {
          last_message_at: now,
          updated_at: now,
        };
        if (senderType === "visitor") {
          updateData.unread_owner_count = (conv.unreadOwnerCount || 0) + 1;
        } else {
          updateData.unread_visitor_count = (conv.unreadVisitorCount || 0) + 1;
        }
        await serverClient.from("chat_conversations").update(updateData).eq("id", conversationId);
      }
      return message;
    } catch (e) {
      if (shouldEnforceProductionPersistence()) throw e;
    }
  }

  return runWithLock(() => {
    const list = localStore.messages[conversationId] || [];
    list.push(message);
    localStore.messages[conversationId] = list;

    // Link attachments in local store
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        if (localStore.attachments[att.id]) {
          localStore.attachments[att.id].messageId = message.id;
        }
      }
    }

    const conv = localStore.conversations[conversationId];
    if (conv) {
      conv.lastMessageAt = now;
      conv.updatedAt = now;
      if (senderType === "visitor") {
        conv.unreadOwnerCount = (conv.unreadOwnerCount || 0) + 1;
      } else {
        conv.unreadVisitorCount = (conv.unreadVisitorCount || 0) + 1;
      }
      localStore.conversations[conversationId] = conv;
    }
    persistStoreToDisk();

    return message;
  });
}

export async function findMessageById(
  conversationId: string,
  messageId: string,
): Promise<ChatMessage | null> {
  const isSupabaseReady = await checkSupabaseAvailable();
  if (isSupabaseReady) {
    try {
      const serverClient = getServerSupabase();
      const { data } = await serverClient
        .from("chat_messages")
        .select("*")
        .eq("id", messageId)
        .eq("conversation_id", conversationId)
        .maybeSingle();

      if (data) {
        return {
          id: data.id,
          conversationId: data.conversation_id,
          senderType: data.sender_type,
          content: data.content,
          createdAt: data.created_at,
          readAt: data.read_at,
          isEdited: Boolean(data.is_edited),
          editedAt: data.edited_at,
          isDeleted: Boolean(data.is_deleted),
          deletedAt: data.deleted_at,
          replyToId: data.reply_to_id,
          reactions: data.reactions || {},
          clientMessageId: data.client_message_id,
        };
      }
    } catch (e) {
      if (shouldEnforceProductionPersistence()) throw e;
    }
  }

  const list = localStore.messages[conversationId] || [];
  return list.find((m) => m.id === messageId) || null;
}

export async function findMessageByClientId(
  conversationId: string,
  clientMessageId: string,
): Promise<ChatMessage | null> {
  const isSupabaseReady = await checkSupabaseAvailable();
  if (isSupabaseReady) {
    try {
      const serverClient = getServerSupabase();
      const { data } = await serverClient
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .eq("client_message_id", clientMessageId)
        .maybeSingle();

      if (data) {
        return {
          id: data.id,
          conversationId: data.conversation_id,
          senderType: data.sender_type,
          content: data.content,
          createdAt: data.created_at,
          readAt: data.read_at,
          isEdited: Boolean(data.is_edited),
          editedAt: data.edited_at,
          isDeleted: Boolean(data.is_deleted),
          deletedAt: data.deleted_at,
          replyToId: data.reply_to_id,
          reactions: data.reactions || {},
          clientMessageId: data.client_message_id,
        };
      }
    } catch (e) {
      if (shouldEnforceProductionPersistence()) throw e;
    }
  }

  const list = localStore.messages[conversationId] || [];
  return list.find((m) => m.clientMessageId === clientMessageId) || null;
}

export async function editMessage(
  messageId: string,
  newContent: string,
  editorType: "visitor" | "owner",
  conversationId: string,
): Promise<ChatMessage | null> {
  const now = new Date().toISOString();
  const isSupabaseReady = await checkSupabaseAvailable();

  if (isSupabaseReady) {
    try {
      const serverClient = getServerSupabase();
      const { data, error } = await serverClient
        .from("chat_messages")
        .update({
          content: newContent,
          is_edited: true,
          edited_at: now,
        })
        .eq("id", messageId)
        .eq("conversation_id", conversationId)
        .eq("sender_type", editorType)
        .eq("is_deleted", false)
        .select()
        .single();

      if (data && !error) {
        return {
          id: data.id,
          conversationId: data.conversation_id,
          senderType: data.sender_type,
          content: data.content,
          createdAt: data.created_at,
          readAt: data.read_at,
          isEdited: true,
          editedAt: now,
          isDeleted: false,
          deletedAt: null,
          replyToId: data.reply_to_id,
          reactions: data.reactions || {},
          clientMessageId: data.client_message_id,
        };
      }
      return null;
    } catch (e) {
      if (shouldEnforceProductionPersistence()) throw e;
    }
  }

  return runWithLock(() => {
    const list = localStore.messages[conversationId] || [];
    const msg = list.find((m) => m.id === messageId);
    if (!msg || msg.senderType !== editorType || msg.isDeleted) return null;

    msg.content = newContent;
    msg.isEdited = true;
    msg.editedAt = now;
    persistStoreToDisk();
    return msg;
  });
}

export async function deleteMessage(
  messageId: string,
  deleterType: "visitor" | "owner",
  conversationId: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const isSupabaseReady = await checkSupabaseAvailable();

  if (isSupabaseReady) {
    try {
      const serverClient = getServerSupabase();
      let query = serverClient
        .from("chat_messages")
        .update({
          content: "[Message deleted]",
          is_deleted: true,
          deleted_at: now,
        })
        .eq("id", messageId)
        .eq("conversation_id", conversationId);

      if (deleterType === "visitor") {
        query = query.eq("sender_type", "visitor");
      }

      const { data, error } = await query.select("id");
      return !error && Array.isArray(data) && data.length > 0;
    } catch (e) {
      if (shouldEnforceProductionPersistence()) throw e;
    }
  }

  return runWithLock(() => {
    const list = localStore.messages[conversationId] || [];
    const msg = list.find((m) => m.id === messageId);
    if (!msg) return false;
    if (deleterType === "visitor" && msg.senderType !== "visitor") return false;

    msg.isDeleted = true;
    msg.deletedAt = now;
    msg.content = "[Message deleted]";
    persistStoreToDisk();
    return true;
  });
}

export async function toggleMessageReaction(
  messageId: string,
  emoji: string,
  senderType: "visitor" | "owner",
  conversationId?: string,
): Promise<ChatMessage["reactions"]> {
  const isSupabaseReady = await checkSupabaseAvailable();

  if (isSupabaseReady) {
    try {
      const serverClient = getServerSupabase();
      let query = serverClient
        .from("chat_messages")
        .select("reactions")
        .eq("id", messageId);
      
      if (conversationId) {
        query = query.eq("conversation_id", conversationId);
      }

      const { data: current } = await query.maybeSingle();

      const reactions = (current?.reactions as Record<string, ("visitor" | "owner")[]>) || {};
      const users = reactions[emoji] || [];

      let updatedUsers: ("visitor" | "owner")[];
      if (users.includes(senderType)) {
        updatedUsers = users.filter((u) => u !== senderType);
      } else {
        updatedUsers = [...users, senderType];
      }

      if (updatedUsers.length > 0) {
        reactions[emoji] = updatedUsers;
      } else {
        delete reactions[emoji];
      }

      await serverClient
        .from("chat_messages")
        .update({ reactions })
        .eq("id", messageId);

      return reactions;
    } catch (e) {
      if (shouldEnforceProductionPersistence()) throw e;
    }
  }

  return runWithLock(() => {
    let targetConvId = conversationId;
    if (!targetConvId) {
      for (const [cId, msgs] of Object.entries(localStore.messages)) {
        if (msgs.some((m) => m.id === messageId)) {
          targetConvId = cId;
          break;
        }
      }
    }

    const list = targetConvId ? localStore.messages[targetConvId] || [] : [];
    const msg = list.find((m) => m.id === messageId);
    if (!msg) return {};

    const reactions = msg.reactions || {};
    const users = reactions[emoji] || [];

    let updatedUsers: ("visitor" | "owner")[];
    if (users.includes(senderType)) {
      updatedUsers = users.filter((u) => u !== senderType);
    } else {
      updatedUsers = [...users, senderType];
    }

    if (updatedUsers.length > 0) {
      reactions[emoji] = updatedUsers;
    } else {
      delete reactions[emoji];
    }

    msg.reactions = reactions;
    persistStoreToDisk();
    return reactions;
  });
}

// ==============================================================================
// ATTACHMENT STORAGE & SERVING
// ==============================================================================

export async function createAttachmentRecord({
  conversationId,
  messageId,
  fileName,
  fileSize,
  mimeType,
  storagePath,
}: {
  conversationId: string;
  messageId?: string | null;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
}): Promise<ChatAttachment> {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const attachment: ChatAttachment = {
    id,
    conversationId,
    messageId: messageId || null,
    fileName,
    fileSize,
    mimeType,
    storagePath,
    createdAt,
  };

  // Always keep in local store for immediate fast memory lookup
  runWithLock(() => {
    localStore.attachments[id] = attachment;
    persistStoreToDisk();
  });

  const isSupabaseReady = await checkSupabaseAvailable();
  if (isSupabaseReady) {
    try {
      const serverClient = getServerSupabase();
      const { error } = await serverClient.from("chat_attachments").insert([
        {
          id: attachment.id,
          conversation_id: attachment.conversationId,
          message_id: attachment.messageId,
          file_name: attachment.fileName,
          file_size: attachment.fileSize,
          mime_type: attachment.mimeType,
          storage_path: attachment.storagePath,
          created_at: attachment.createdAt,
        },
      ]);
      if (!error) {
        return attachment;
      }
      if (shouldEnforceProductionPersistence()) {
        throw new DatabaseUnavailableError(`Supabase chat_attachments insert failed: ${error.message}`);
      }
      console.warn("[Live Chat DB] Error inserting attachment in Supabase, using durable storage:", error.message);
    } catch (e) {
      if (shouldEnforceProductionPersistence()) throw e;
    }
  }

  return attachment;
}

export async function getAttachmentById(id: string): Promise<ChatAttachment | null> {
  const isSupabaseReady = await checkSupabaseAvailable();
  if (isSupabaseReady) {
    try {
      const serverClient = getServerSupabase();
      const { data, error } = await serverClient
        .from("chat_attachments")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (data && !error) {
        return {
          id: data.id,
          conversationId: data.conversation_id,
          messageId: data.message_id,
          fileName: data.file_name,
          fileSize: Number(data.file_size),
          mimeType: data.mime_type,
          storagePath: data.storage_path,
          createdAt: data.created_at,
        };
      }
    } catch (e) {
      if (shouldEnforceProductionPersistence()) throw e;
    }
  }

  return localStore.attachments[id] || null;
}

// ==============================================================================
// CONVERSATION ACTIONS (DELETE, ARCHIVE, READ)
// ==============================================================================

export async function markMessagesAsRead(
  conversationId: string,
  readerType: "owner" | "visitor",
): Promise<void> {
  const now = new Date().toISOString();
  const isSupabaseReady = await checkSupabaseAvailable();

  if (isSupabaseReady) {
    try {
      const serverClient = getServerSupabase();
      const oppositeSender = readerType === "owner" ? "visitor" : "owner";
      await serverClient
        .from("chat_messages")
        .update({ read_at: now })
        .eq("conversation_id", conversationId)
        .eq("sender_type", oppositeSender)
        .is("read_at", null);

      const updateData =
        readerType === "owner" ? { unread_owner_count: 0 } : { unread_visitor_count: 0 };

      await serverClient.from("chat_conversations").update(updateData).eq("id", conversationId);
    } catch (e) {
      if (shouldEnforceProductionPersistence()) throw e;
    }
  }

  runWithLock(() => {
    const msgs = localStore.messages[conversationId] || [];
    msgs.forEach((m) => {
      if (readerType === "owner" && m.senderType === "visitor") m.readAt = now;
      if (readerType === "visitor" && m.senderType === "owner") m.readAt = now;
    });

    const conv = localStore.conversations[conversationId];
    if (conv) {
      if (readerType === "owner") conv.unreadOwnerCount = 0;
      if (readerType === "visitor") conv.unreadVisitorCount = 0;
      localStore.conversations[conversationId] = conv;
    }
    persistStoreToDisk();
  });
}

export async function deleteConversationByAdmin(conversationId: string): Promise<boolean> {
  const isSupabaseReady = await checkSupabaseAvailable();

  if (isSupabaseReady) {
    try {
      const serverClient = getServerSupabase();
      // Delete conversation cascades to messages, attachments, logs, and otps
      const { error } = await serverClient
        .from("chat_conversations")
        .delete()
        .eq("id", conversationId);

      if (!error) {
        runWithLock(() => {
          delete localStore.conversations[conversationId];
          delete localStore.messages[conversationId];
          delete localStore.emailOtps[conversationId];
          persistStoreToDisk();
        });
        return true;
      }
      if (shouldEnforceProductionPersistence()) {
        throw new DatabaseUnavailableError(`Supabase chat_conversations delete failed: ${error.message}`);
      }
      console.warn("[Live Chat DB] Error deleting conversation in Supabase, using durable storage:", error.message);
    } catch (e) {
      if (shouldEnforceProductionPersistence()) throw e;
    }
  }

  return runWithLock(() => {
    const conv = localStore.conversations[conversationId];
    if (!conv) return false;

    delete localStore.conversations[conversationId];
    delete localStore.messages[conversationId];
    delete localStore.emailOtps[conversationId];
    if (conv.sessionTokenHash) {
      delete localStore.hashToId[conv.sessionTokenHash];
    }

    persistStoreToDisk();
    return true;
  });
}

export async function archiveConversationByAdmin(
  conversationId: string,
  isArchived: boolean,
): Promise<boolean> {
  const isSupabaseReady = await checkSupabaseAvailable();

  if (isSupabaseReady) {
    try {
      const serverClient = getServerSupabase();
      const { error } = await serverClient
        .from("chat_conversations")
        .update({ is_archived: isArchived, updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      if (!error) {
        return true;
      }
      if (shouldEnforceProductionPersistence()) {
        throw new DatabaseUnavailableError(`Supabase chat_conversations archive failed: ${error.message}`);
      }
      console.warn("[Live Chat DB] Error archiving conversation in Supabase, using durable storage:", error.message);
    } catch (e) {
      if (shouldEnforceProductionPersistence()) throw e;
    }
  }

  return runWithLock(() => {
    const conv = localStore.conversations[conversationId];
    if (!conv) return false;

    conv.isArchived = isArchived;
    conv.updatedAt = new Date().toISOString();
    persistStoreToDisk();
    return true;
  });
}

export async function pinConversationByAdmin(
  conversationId: string,
  isPinned: boolean,
): Promise<boolean> {
  const now = new Date().toISOString();

  // Always update local store so pin state persists locally across restarts
  runWithLock(() => {
    let conv = localStore.conversations[conversationId];
    if (!conv) {
      conv = {
        id: conversationId,
        sessionTokenHash: "",
        visitorName: "Visitor",
        visitorEmail: null,
        emailVerified: false,
        emailNotificationsEnabled: false,
        createdAt: now,
        updatedAt: now,
        lastMessageAt: now,
        unreadOwnerCount: 0,
        unreadVisitorCount: 0,
        isArchived: false,
        isDeleted: false,
        isPinned: isPinned,
        pinnedAt: isPinned ? now : null,
      };
      localStore.conversations[conversationId] = conv;
    } else {
      conv.isPinned = isPinned;
      conv.pinnedAt = isPinned ? now : null;
      conv.updatedAt = now;
    }
    persistStoreToDisk();
  });

  const isSupabaseReady = await checkSupabaseAvailable();

  if (isSupabaseReady) {
    try {
      const serverClient = getServerSupabase();
      const { error } = await serverClient
        .from("chat_conversations")
        .update({
          is_pinned: isPinned,
          pinned_at: isPinned ? now : null,
          updated_at: now,
        })
        .eq("id", conversationId);

      if (!error) {
        return true;
      }
      if (shouldEnforceProductionPersistence()) {
        throw new DatabaseUnavailableError(`Supabase chat_conversations pin failed: ${error.message}`);
      }
      console.warn("[Live Chat DB] Error pinning conversation in Supabase, using durable storage:", error.message);
    } catch (e) {
      if (shouldEnforceProductionPersistence()) throw e;
    }
  }

  return true;
}

export async function getAllConversationsForAdmin(filter?: {
  status?: "all" | "unread" | "read" | "awaiting_reply" | "archived";
  search?: string;
}): Promise<(Conversation & { latestMessage?: string })[]> {
  const isSupabaseReady = await checkSupabaseAvailable();

  if (isSupabaseReady) {
    try {
      const serverClient = getServerSupabase();
      const { data, error } = await serverClient
        .from("chat_conversations")
        .select("*, chat_messages(content, created_at, sender_type, is_deleted)")
        .eq("is_deleted", false)
        .order("last_message_at", { ascending: false });

      if (data && !error) {
        const list = data.map((d) => {
          const msgs = (d.chat_messages as {
            content: string;
            created_at: string;
            sender_type: string;
            is_deleted?: boolean;
          }[]) || [];

          const sorted = msgs.sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          );
          const mapped = mapSupabaseConversation(d);
          if (d.is_pinned === undefined || d.is_pinned === null) {
            const localRecord = localStore.conversations[String(d.id)];
            if (localRecord && typeof localRecord.isPinned === "boolean") {
              mapped.isPinned = localRecord.isPinned;
              mapped.pinnedAt = localRecord.pinnedAt || null;
            }
          }
          const latest = sorted[0];
          return {
            ...mapped,
            latestMessage: latest
              ? latest.is_deleted
                ? "[Message deleted]"
                : latest.content
              : "No messages yet",
          };
        });

        return applyConversationFilters(list, filter);
      }
    } catch (e) {
      if (shouldEnforceProductionPersistence()) throw e;
    }
  }

  const list: (Conversation & { latestMessage?: string })[] = [];
  for (const conv of Object.values(localStore.conversations)) {
    if (conv.isDeleted) continue;
    const msgs = localStore.messages[conv.id] || [];
    const latest = msgs[msgs.length - 1];
    const preview = latest
      ? latest.isDeleted
        ? "[Message deleted]"
        : latest.content
      : "No messages yet";
    list.push({ ...conv, latestMessage: preview });
  }

  const sorted = list.sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
  );

  return applyConversationFilters(sorted, filter);
}

function applyConversationFilters(
  list: (Conversation & { latestMessage?: string })[],
  filter?: {
    status?: "all" | "unread" | "read" | "awaiting_reply" | "archived";
    search?: string;
  },
): (Conversation & { latestMessage?: string })[] {
  let result = list;

  if (filter?.status === "archived") {
    result = result.filter((c) => c.isArchived);
  } else {
    // Default exclude archived from main views
    result = result.filter((c) => !c.isArchived);

    if (filter?.status === "unread") {
      result = result.filter((c) => c.unreadOwnerCount > 0);
    } else if (filter?.status === "read") {
      result = result.filter((c) => c.unreadOwnerCount === 0);
    } else if (filter?.status === "awaiting_reply") {
      result = result.filter((c) => c.unreadOwnerCount > 0);
    }
  }

  if (filter?.search) {
    const q = filter.search.toLowerCase().trim();
    result = result.filter(
      (c) =>
        c.visitorName.toLowerCase().includes(q) ||
        (c.visitorEmail && c.visitorEmail.toLowerCase().includes(q)) ||
        (c.latestMessage && c.latestMessage.toLowerCase().includes(q)),
    );
  }

  // Sort pinned conversations before unpinned conversations while preserving existing sorting behavior within each group
  return result.sort((a, b) => {
    const aPinned = Boolean(a.isPinned);
    const bPinned = Boolean(b.isPinned);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });
}

/**
 * Retrieve complete persisted conversation history for server-side PDF generation
 */
export async function getFullConversationHistoryForPdf(
  conversationId: string,
): Promise<{ conversation: Conversation; messages: ChatMessage[] } | null> {
  const conv = await getConversationById(conversationId);
  if (!conv) return null;

  const messages = await getMessages(conversationId, { limit: 1000 });
  return { conversation: conv, messages };
}

/**
 * Concurrency-Safe Atomic Notification Lock Claim
 */
export async function claimNotificationLock(
  conversationId: string,
  recipientType: "owner" | "visitor",
  cooldownMs: number,
): Promise<boolean> {
  const now = new Date();
  const thresholdIso = new Date(now.getTime() - cooldownMs).toISOString();
  const nowIso = now.toISOString();

  const isSupabaseReady = await checkSupabaseAvailable();
  if (isSupabaseReady) {
    try {
      const serverClient = getServerSupabase();
      const field =
        recipientType === "owner" ? "last_owner_notification_at" : "last_visitor_notification_at";

      const { data, error } = await serverClient
        .from("chat_conversations")
        .update({ [field]: nowIso })
        .eq("id", conversationId)
        .or(`${field}.is.null,${field}.lt.${thresholdIso}`)
        .select("id");

      if (!error && Array.isArray(data) && data.length > 0) {
        return true;
      }
      return false;
    } catch (e) {
      if (shouldEnforceProductionPersistence()) throw e;
    }
  }

  return runWithLock(() => {
    const conv = localStore.conversations[conversationId];
    if (!conv) return false;

    const lastTimestamp =
      recipientType === "owner" ? conv.lastOwnerNotificationAt : conv.lastVisitorNotificationAt;

    if (lastTimestamp) {
      const elapsed = Date.now() - new Date(lastTimestamp).getTime();
      if (elapsed < cooldownMs) {
        return false;
      }
    }

    if (recipientType === "owner") {
      conv.lastOwnerNotificationAt = nowIso;
    } else {
      conv.lastVisitorNotificationAt = nowIso;
    }
    conv.updatedAt = nowIso;
    localStore.conversations[conversationId] = conv;
    persistStoreToDisk();

    return true;
  });
}

/**
 * Safely release or rollback notification lock when email dispatch fails
 */
export async function releaseNotificationLock(
  conversationId: string,
  recipientType: "owner" | "visitor",
  previousTimestamp: string | null = null,
): Promise<void> {
  const isSupabaseReady = await checkSupabaseAvailable();
  if (isSupabaseReady) {
    try {
      const serverClient = getServerSupabase();
      const field =
        recipientType === "owner" ? "last_owner_notification_at" : "last_visitor_notification_at";

      await serverClient
        .from("chat_conversations")
        .update({ [field]: previousTimestamp })
        .eq("id", conversationId);
    } catch {
      // Non-fatal lock rollback
    }
  }

  runWithLock(() => {
    const conv = localStore.conversations[conversationId];
    if (conv) {
      if (recipientType === "owner") {
        conv.lastOwnerNotificationAt = previousTimestamp;
      } else {
        conv.lastVisitorNotificationAt = previousTimestamp;
      }
      localStore.conversations[conversationId] = conv;
      persistStoreToDisk();
    }
  });
}

export async function logNotification(entry: Omit<NotificationLog, "id" | "sentAt">): Promise<void> {
  const log: NotificationLog = {
    id: crypto.randomUUID(),
    sentAt: new Date().toISOString(),
    ...entry,
  };

  const isSupabaseReady = await checkSupabaseAvailable();
  if (isSupabaseReady) {
    try {
      const serverClient = getServerSupabase();
      await serverClient.from("chat_notification_logs").insert([
        {
          id: log.id,
          conversation_id: log.conversationId,
          recipient_type: log.recipientType,
          recipient_email: log.recipientEmail,
          sent_at: log.sentAt,
          status: log.status,
          message_preview: log.messagePreview,
        },
      ]);
    } catch {
      // Non-fatal logging
    }
  }

  runWithLock(() => {
    localStore.notificationLogs.push(log);
    persistStoreToDisk();
  });
}
