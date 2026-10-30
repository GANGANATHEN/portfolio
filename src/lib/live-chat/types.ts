import type { VisitorMetadata } from "../metadata";
export type { VisitorMetadata };

export interface ChatAttachment {
  id: string;
  conversationId: string;
  messageId?: string | null;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderType: "visitor" | "owner";
  content: string;
  createdAt: string;
  readAt?: string | null;
  isEdited?: boolean;
  editedAt?: string | null;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedBy?: "visitor" | "owner" | null;
  replyToId?: string | null;
  replyPreview?: {
    id: string;
    senderType: "visitor" | "owner";
    content: string;
    snippet?: string;
  } | null;
  reactions?: Record<string, ("visitor" | "owner")[]>;
  attachments?: ChatAttachment[];
  clientMessageId?: string | null;
}

export interface Conversation {
  id: string;
  sessionTokenHash: string;
  visitorName: string;
  visitorEmail?: string | null;
  emailVerified: boolean;
  emailNotificationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  unreadOwnerCount: number;
  unreadVisitorCount: number;
  lastOwnerNotificationAt?: string | null;
  lastVisitorNotificationAt?: string | null;
  isArchived?: boolean;
  isDeleted?: boolean;
  isPinned?: boolean;
  pinnedAt?: string | null;
  metadata?: VisitorMetadata | null;
}

export interface NotificationLog {
  id: string;
  conversationId: string;
  recipientType: "owner" | "visitor";
  recipientEmail: string;
  sentAt: string;
  status: "sent" | "failed" | "throttled";
  messagePreview: string;
}

export interface VisitorSessionState {
  conversationId: string;
  visitorName: string;
  visitorEmail: string | null;
  emailVerified: boolean;
  emailNotificationsEnabled: boolean;
  unreadVisitorCount: number;
}

export interface EmailOtpRecord {
  id: string;
  conversationId: string;
  email: string;
  otpHash: string;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  expiresAt: string;
  usedAt?: string | null;
}

export interface ChatArchiveBatch {
  id: string;
  conversationId: string;
  messageIds: string[];
  messageCount: number;
  status:
    | "pending"
    | "processing"
    | "pdf_generated"
    | "email_submitted"
    | "delivered"
    | "deleted"
    | "failed";
  pdfStoragePath?: string | null;
  cutoffReadAt?: string | null;
  emailMessageId?: string | null;
  deliveryConfirmedAt?: string | null;
  deletedAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveSessionRecord {
  accountType: "admin" | "visitor";
  accountId: string; // 'admin' or normalized visitor email
  sessionId: string;
  tokenHash: string;
  conversationId?: string | null;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  isActive: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface SupersededSessionRecord {
  tokenHash: string;
  accountType: "admin" | "visitor";
  accountId: string;
  supersededAt: string;
  reason: "superseded_by_new_login" | "logout" | "expired";
}
