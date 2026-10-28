import type { Conversation, ChatMessage, NotificationLog } from "./types";
import { supabase } from "../supabase";
import crypto from "crypto";

// Fallback in-memory store for development/preview or before Supabase table migration
const memoryConversations = new Map<string, Conversation>(); // keyed by id
const memoryHashToId = new Map<string, string>(); // sessionTokenHash -> conversationId
const memoryMessages = new Map<string, ChatMessage[]>(); // conversationId -> messages[]
const memoryNotificationLogs: NotificationLog[] = [];

// Track if Supabase tables are ready
let supabaseTablesAvailable: boolean | null = null;

async function checkSupabaseAvailable(): Promise<boolean> {
  if (supabaseTablesAvailable !== null) return supabaseTablesAvailable;
  try {
    const { error } = await supabase.from("chat_conversations").select("id").limit(1);
    supabaseTablesAvailable = !error;
    if (error) {
      console.warn("[Live Chat DB] Supabase table 'chat_conversations' not accessible yet. Using resilient storage adapter. Error:", error.message);
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
      const { data, error } = await supabase
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

      // Create new in Supabase
      const newConv = {
        id: crypto.randomUUID(),
        session_token_hash: sessionTokenHash,
        visitor_name: defaultName,
        email_notifications_enabled: false,
        unread_owner_count: 0,
        unread_visitor_count: 0,
        last_message_at: new Date().toISOString(),
      };

      const { data: inserted, error: insertError } = await supabase
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
      console.warn("[Live Chat DB] Error creating conversation in Supabase, falling back to memory:", e);
    }
  }

  // Memory fallback
  const existingId = memoryHashToId.get(sessionTokenHash);
  if (existingId && memoryConversations.has(existingId)) {
    return memoryConversations.get(existingId)!;
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

  memoryConversations.set(newId, conv);
  memoryHashToId.set(sessionTokenHash, newId);
  memoryMessages.set(newId, []);
  return conv;
}

export async function getConversationByHash(sessionTokenHash: string): Promise<Conversation | null> {
  const isSupabaseReady = await checkSupabaseAvailable();

  if (isSupabaseReady) {
    try {
      const { data, error } = await supabase
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
      // Fallback to memory
    }
  }

  const id = memoryHashToId.get(sessionTokenHash);
  if (id && memoryConversations.has(id)) {
    return memoryConversations.get(id)!;
  }
  return null;
}

export async function getConversationById(id: string): Promise<Conversation | null> {
  const isSupabaseReady = await checkSupabaseAvailable();

  if (isSupabaseReady) {
    try {
      const { data, error } = await supabase
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
      // Fallback to memory
    }
  }

  return memoryConversations.get(id) || null;
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
      await supabase
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

  // Update memory store
  conv.visitorName = updatedName;
  conv.visitorEmail = updatedEmail;
  conv.emailNotificationsEnabled = updatedNotify;
  conv.updatedAt = now;
  memoryConversations.set(conv.id, conv);

  return conv;
}

export async function getMessages(conversationId: string): Promise<ChatMessage[]> {
  const isSupabaseReady = await checkSupabaseAvailable();

  if (isSupabaseReady) {
    try {
      const { data, error } = await supabase
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
      // Fallback to memory
    }
  }

  return memoryMessages.get(conversationId) || [];
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
      await supabase.from("chat_messages").insert([
        {
          id: message.id,
          conversation_id: conversationId,
          sender_type: senderType,
          content: content,
          created_at: now,
        },
      ]);

      // Increment unread count & update last_message_at
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

        await supabase.from("chat_conversations").update(updateData).eq("id", conversationId);
      }
    } catch (e) {
      console.warn("[Live Chat DB] Error adding message to Supabase:", e);
    }
  }

  // Memory store
  const list = memoryMessages.get(conversationId) || [];
  list.push(message);
  memoryMessages.set(conversationId, list);

  const conv = memoryConversations.get(conversationId);
  if (conv) {
    conv.lastMessageAt = now;
    conv.updatedAt = now;
    if (senderType === "visitor") {
      conv.unreadOwnerCount = (conv.unreadOwnerCount || 0) + 1;
    } else {
      conv.unreadVisitorCount = (conv.unreadVisitorCount || 0) + 1;
    }
    memoryConversations.set(conversationId, conv);
  }

  return message;
}

export async function markMessagesAsRead(
  conversationId: string,
  readerType: "owner" | "visitor",
): Promise<void> {
  const now = new Date().toISOString();
  const isSupabaseReady = await checkSupabaseAvailable();

  if (isSupabaseReady) {
    try {
      // Mark opposite sender messages as read
      const oppositeSender = readerType === "owner" ? "visitor" : "owner";
      await supabase
        .from("chat_messages")
        .update({ read_at: now })
        .eq("conversation_id", conversationId)
        .eq("sender_type", oppositeSender)
        .is("read_at", null);

      const updateData =
        readerType === "owner" ? { unread_owner_count: 0 } : { unread_visitor_count: 0 };

      await supabase.from("chat_conversations").update(updateData).eq("id", conversationId);
    } catch (e) {
      console.warn("[Live Chat DB] Error marking read in Supabase:", e);
    }
  }

  // Update memory
  const msgs = memoryMessages.get(conversationId) || [];
  msgs.forEach((m) => {
    if (readerType === "owner" && m.senderType === "visitor") m.readAt = now;
    if (readerType === "visitor" && m.senderType === "owner") m.readAt = now;
  });

  const conv = memoryConversations.get(conversationId);
  if (conv) {
    if (readerType === "owner") conv.unreadOwnerCount = 0;
    if (readerType === "visitor") conv.unreadVisitorCount = 0;
  }
}

export async function getAllConversationsForAdmin(): Promise<
  (Conversation & { latestMessage?: string })[]
> {
  const isSupabaseReady = await checkSupabaseAvailable();

  if (isSupabaseReady) {
    try {
      const { data, error } = await supabase
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
      // Fallback to memory
    }
  }

  const list: (Conversation & { latestMessage?: string })[] = [];
  for (const conv of memoryConversations.values()) {
    const msgs = memoryMessages.get(conv.id) || [];
    const latest = msgs[msgs.length - 1]?.content || "No messages yet";
    list.push({ ...conv, latestMessage: latest });
  }

  return list.sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
  );
}

export async function updateNotificationTimestamp(
  conversationId: string,
  recipientType: "owner" | "visitor",
): Promise<void> {
  const now = new Date().toISOString();
  const isSupabaseReady = await checkSupabaseAvailable();

  if (isSupabaseReady) {
    try {
      const field =
        recipientType === "owner" ? "last_owner_notification_at" : "last_visitor_notification_at";
      await supabase
        .from("chat_conversations")
        .update({ [field]: now })
        .eq("id", conversationId);
    } catch (e) {
      console.warn("[Live Chat DB] Error updating notification timestamp in Supabase:", e);
    }
  }

  const conv = memoryConversations.get(conversationId);
  if (conv) {
    if (recipientType === "owner") conv.lastOwnerNotificationAt = now;
    if (recipientType === "visitor") conv.lastVisitorNotificationAt = now;
  }
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
      await supabase.from("chat_notification_logs").insert([
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

  memoryNotificationLogs.push(log);
}
