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
