import type { Conversation, ChatMessage, NotificationLog } from "./types";
import { getServerSupabase } from "../supabase";
import crypto from "crypto";
import fs from "fs";
import path from "path";

// Durable local storage path for persistent offline & dev execution
const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_FILE = path.join(DATA_DIR, "live-chat-store.json");

interface PersistentStore {
  conversations: Record<string, Conversation>; // id -> Conversation
  hashToId: Record<string, string>; // sessionTokenHash -> conversationId
  messages: Record<string, ChatMessage[]>; // conversationId -> ChatMessage[]
  notificationLogs: NotificationLog[];
}

// In-memory cache synced with disk
let localStore: PersistentStore = {
  conversations: {},
  hashToId: {},
  messages: {},
  notificationLogs: [],
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
    if (fs.existsSync(STORE_FILE)) {
      const content = fs.readFileSync(STORE_FILE, "utf-8");
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === "object") {
        localStore = {
          conversations: parsed.conversations || {},
          hashToId: parsed.hashToId || {},
          messages: parsed.messages || {},
          notificationLogs: parsed.notificationLogs || [],
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
    const tempFile = `${STORE_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(localStore, null, 2), "utf-8");
    fs.renameSync(tempFile, STORE_FILE);
  } catch (err) {
    console.warn("[Live Chat DB] Could not write local persistent store to disk:", err);
  }
}

// Track Supabase table status
let supabaseTablesAvailable: boolean | null = null;
let lastSupabaseCheckTime = 0;

async function checkSupabaseAvailable(): Promise<boolean> {
  const now = Date.now();
  // Cache positive check, or retry negative checks after 15 seconds
  if (supabaseTablesAvailable === true) return true;
  if (supabaseTablesAvailable === false && now - lastSupabaseCheckTime < 15000) {
    return false;
  }

  lastSupabaseCheckTime = now;
  try {
    const serverClient = getServerSupabase();
    const { error } = await serverClient.from("chat_conversations").select("id").limit(1);
    supabaseTablesAvailable = !error;
    if (error) {
      console.warn("[Live Chat DB] Supabase table 'chat_conversations' not ready. Using durable storage adapter. Error:", error.message);
    } else {
      console.log("[Live Chat DB] Supabase connected successfully for Live Chat.");
    }
  } catch {
    supabaseTablesAvailable = false;
  }
  return supabaseTablesAvailable;
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
        .maybeSingle();

      if (data && !error) {
        return {
          id: data.id,
          sessionTokenHash: data.session_token_hash,
          visitorName: data.visitor_name,
          visitorEmail: data.visitor_email,
          emailNotificationsEnabled: data.email_notifications_enabled,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          lastMessageAt: data.last_message_at,
          unreadOwnerCount: data.unread_owner_count,
          unreadVisitorCount: data.unread_visitor_count,
          lastOwnerNotificationAt: data.last_owner_notification_at,
          lastVisitorNotificationAt: data.last_visitor_notification_at,
        };
      }

      // Insert new conversation
      const newId = crypto.randomUUID();
      const newConv = {
        id: newId,
        session_token_hash: sessionTokenHash,
        visitor_name: defaultName,
        email_notifications_enabled: false,
        unread_owner_count: 0,
        unread_visitor_count: 0,
        last_message_at: new Date().toISOString(),
      };

      const { data: inserted, error: insertError } = await serverClient
        .from("chat_conversations")
        .insert([newConv])
        .select()
        .single();

      if (inserted && !insertError) {
        return {
          id: inserted.id,
          sessionTokenHash: inserted.session_token_hash,
          visitorName: inserted.visitor_name,
          visitorEmail: inserted.visitor_email,
          emailNotificationsEnabled: inserted.email_notifications_enabled,
          createdAt: inserted.created_at,
          updatedAt: inserted.updated_at,
          lastMessageAt: inserted.last_message_at,
          unreadOwnerCount: inserted.unread_owner_count,
          unreadVisitorCount: inserted.unread_visitor_count,
          lastOwnerNotificationAt: inserted.last_owner_notification_at,
          lastVisitorNotificationAt: inserted.last_visitor_notification_at,
        };
      }
    } catch (e) {
      console.warn("[Live Chat DB] Error creating conversation in Supabase, using durable storage:", e);
    }
  }

  // Durable store fallback
  return runWithLock(() => {
    const existingId = localStore.hashToId[sessionTokenHash];
    if (existingId && localStore.conversations[existingId]) {
      return localStore.conversations[existingId];
    }

    const newId = crypto.randomUUID();
    const now = new Date().toISOString();
    const conv: Conversation = {
      id: newId,
      sessionTokenHash,
      visitorName: defaultName,
      visitorEmail: null,
      emailNotificationsEnabled: false,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      unreadOwnerCount: 0,
      unreadVisitorCount: 0,
      lastOwnerNotificationAt: null,
      lastVisitorNotificationAt: null,
    };

    localStore.conversations[newId] = conv;
    localStore.hashToId[sessionTokenHash] = newId;
    localStore.messages[newId] = [];
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
        .maybeSingle();

      if (data && !error) {
        return {
          id: data.id,
          sessionTokenHash: data.session_token_hash,
          visitorName: data.visitor_name,
          visitorEmail: data.visitor_email,
          emailNotificationsEnabled: data.email_notifications_enabled,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          lastMessageAt: data.last_message_at,
          unreadOwnerCount: data.unread_owner_count,
          unreadVisitorCount: data.unread_visitor_count,
          lastOwnerNotificationAt: data.last_owner_notification_at,
          lastVisitorNotificationAt: data.last_visitor_notification_at,
        };
      }
    } catch {
      // Fallback
    }
  }

  const id = localStore.hashToId[sessionTokenHash];
  return (id && localStore.conversations[id]) || null;
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
        .maybeSingle();

      if (data && !error) {
        return {
          id: data.id,
          sessionTokenHash: data.session_token_hash,
          visitorName: data.visitor_name,
          visitorEmail: data.visitor_email,
          emailNotificationsEnabled: data.email_notifications_enabled,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          lastMessageAt: data.last_message_at,
          unreadOwnerCount: data.unread_owner_count,
          unreadVisitorCount: data.unread_visitor_count,
          lastOwnerNotificationAt: data.last_owner_notification_at,
          lastVisitorNotificationAt: data.last_visitor_notification_at,
        };
      }
    } catch {
      // Fallback
    }
  }

  return localStore.conversations[id] || null;
}

export async function updateConversationProfile(
  sessionTokenHash: string,
  profile: { visitorName?: string; visitorEmail?: string | null; emailNotificationsEnabled?: boolean },
): Promise<Conversation | null> {
  const conv = await getConversationByHash(sessionTokenHash);
  if (!conv) return null;

  const updatedName = profile.visitorName !== undefined ? profile.visitorName.trim() : conv.visitorName;
  const updatedEmail = profile.visitorEmail !== undefined ? profile.visitorEmail : conv.visitorEmail;
  const updatedNotify = profile.emailNotificationsEnabled !== undefined ? profile.emailNotificationsEnabled : conv.emailNotificationsEnabled;
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
          email_notifications_enabled: updatedNotify,
          updated_at: now,
        })
        .eq("id", conv.id);
    } catch (e) {
      console.warn("[Live Chat DB] Error updating profile in Supabase:", e);
    }
  }

  // Update local durable store
  return runWithLock(() => {
    conv.visitorName = updatedName;
    conv.visitorEmail = updatedEmail;
    conv.emailNotificationsEnabled = updatedNotify;
    conv.updatedAt = now;
    localStore.conversations[conv.id] = conv;
    persistStoreToDisk();
    return conv;
  });
}

export async function getMessages(conversationId: string): Promise<ChatMessage[]> {
  const isSupabaseReady = await checkSupabaseAvailable();

  if (isSupabaseReady) {
    try {
      const serverClient = getServerSupabase();
      const { data, error } = await serverClient
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (data && !error) {
        return data.map((m) => ({
          id: m.id,
          conversationId: m.conversation_id,
          senderType: m.sender_type,
          content: m.content,
          createdAt: m.created_at,
          readAt: m.read_at,
        }));
      }
    } catch {
      // Fallback
    }
  }

  return localStore.messages[conversationId] || [];
}

export async function addMessage({
  conversationId,
  senderType,
  content,
}: {
  conversationId: string;
  senderType: "visitor" | "owner";
  content: string;
}): Promise<ChatMessage> {
  const now = new Date().toISOString();
  const message: ChatMessage = {
    id: crypto.randomUUID(),
    conversationId,
    senderType,
    content,
    createdAt: now,
    readAt: null,
  };

  const isSupabaseReady = await checkSupabaseAvailable();
  if (isSupabaseReady) {
    try {
      const serverClient = getServerSupabase();
      await serverClient.from("chat_messages").insert([
        {
          id: message.id,
          conversation_id: conversationId,
          sender_type: senderType,
          content: content,
          created_at: now,
        },
      ]);

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
    } catch (e) {
      console.warn("[Live Chat DB] Error adding message to Supabase:", e);
    }
  }

  // Update local durable store
  return runWithLock(() => {
    const list = localStore.messages[conversationId] || [];
    list.push(message);
    localStore.messages[conversationId] = list;

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
      console.warn("[Live Chat DB] Error marking read in Supabase:", e);
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

export async function getAllConversationsForAdmin(): Promise<
  (Conversation & { latestMessage?: string })[]
> {
  const isSupabaseReady = await checkSupabaseAvailable();

  if (isSupabaseReady) {
    try {
      const serverClient = getServerSupabase();
      const { data, error } = await serverClient
        .from("chat_conversations")
        .select("*, chat_messages(content, created_at)")
        .order("last_message_at", { ascending: false });

      if (data && !error) {
        return data.map((d) => {
          const msgs = (d.chat_messages as { content: string; created_at: string }[]) || [];
          const sorted = msgs.sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          );
          return {
            id: d.id,
            sessionTokenHash: d.session_token_hash,
            visitorName: d.visitor_name,
            visitorEmail: d.visitor_email,
            emailNotificationsEnabled: d.email_notifications_enabled,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
            lastMessageAt: d.last_message_at,
            unreadOwnerCount: d.unread_owner_count,
            unreadVisitorCount: d.unread_visitor_count,
            lastOwnerNotificationAt: d.last_owner_notification_at,
            lastVisitorNotificationAt: d.last_visitor_notification_at,
            latestMessage: sorted[0]?.content || "No messages yet",
          };
        });
      }
    } catch {
      // Fallback
    }
  }

  const list: (Conversation & { latestMessage?: string })[] = [];
  for (const conv of Object.values(localStore.conversations)) {
    const msgs = localStore.messages[conv.id] || [];
    const latest = msgs[msgs.length - 1]?.content || "No messages yet";
    list.push({ ...conv, latestMessage: latest });
  }

  return list.sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
  );
}

/**
 * Concurrency-Safe Atomic Notification Lock Claim
 * Evaluates cooldown independently per conversation.
 * If lock is granted, sets timestamp to NOW and returns true.
 * If cooldown is still active, returns false.
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

      // Atomic conditional update on Postgres: matches ONLY IF null OR older than threshold
      const { data, error } = await serverClient
        .from("chat_conversations")
        .update({ [field]: nowIso })
        .eq("id", conversationId)
        .or(`${field}.is.null,${field}.lt.${thresholdIso}`)
        .select("id");

      if (!error && Array.isArray(data) && data.length > 0) {
        return true; // Lock successfully claimed atomically in Supabase
      }
      return false; // Cooldown is active or row not found
    } catch (e) {
      console.warn("[Live Chat DB] Error in atomic Supabase lock claim, falling back:", e);
    }
  }

  // Durable store atomic lock claim with Node mutex
  return runWithLock(() => {
    const conv = localStore.conversations[conversationId];
    if (!conv) return false;

    const lastTimestamp =
      recipientType === "owner" ? conv.lastOwnerNotificationAt : conv.lastVisitorNotificationAt;

    if (lastTimestamp) {
      const elapsed = Date.now() - new Date(lastTimestamp).getTime();
      if (elapsed < cooldownMs) {
        return false; // Throttled! Cooldown is active for this conversation
      }
    }

    // Atomically claim lock right now
    if (recipientType === "owner") {
      conv.lastOwnerNotificationAt = nowIso;
    } else {
      conv.lastVisitorNotificationAt = nowIso;
    }
    conv.updatedAt = nowIso;
    localStore.conversations[conversationId] = conv;
    persistStoreToDisk();

    return true; // Successfully claimed
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
      // Ignored
    }
  }

  runWithLock(() => {
    localStore.notificationLogs.push(log);
    persistStoreToDisk();
  });
}
