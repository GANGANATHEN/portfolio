export interface Conversation {
  id: string;
  sessionTokenHash: string;
  visitorName: string;
  visitorEmail?: string | null;
  emailNotificationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  unreadOwnerCount: number;
  unreadVisitorCount: number;
  lastOwnerNotificationAt?: string | null;
  lastVisitorNotificationAt?: string | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderType: "visitor" | "owner";
  content: string;
  createdAt: string;
  readAt?: string | null;
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
  emailNotificationsEnabled: boolean;
  unreadVisitorCount: number;
}

