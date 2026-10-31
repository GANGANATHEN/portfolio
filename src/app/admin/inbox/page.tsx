"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Search,
  X,
  Send,
  Paperclip,
  Smile,
  SmilePlus,
  Reply,
  Pencil,
  Trash2,
  Copy,
  Check,
  CheckCheck,
  CheckSquare,
  Download,
  FileDown,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  LogOut,
  FileText,
  Lock,
  Archive,
  Inbox,
  Clock,
  Mail,
  Maximize2,
  SlidersHorizontal,
  ChevronRight,
  MoreVertical,
  Pin,
  PinOff,
  Info,
  Globe,
  Laptop,
  Smartphone,
  Tablet,
  MapPin,
  Terminal,
  Images,
} from "lucide-react";
import TelegramEmojiPicker from "@/components/LiveChat/TelegramEmojiPicker";
import AttachmentViewerModal, { type ViewerAttachment } from "@/components/LiveChat/AttachmentViewerModal";
import type { VisitorMetadata } from "@/lib/metadata";

interface AttachmentItem {
  id: string;
  conversationId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

interface ReplyPreviewItem {
  id: string;
  senderType: "visitor" | "owner";
  content: string;
  snippet?: string;
}

interface MessageItem {
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
  replyPreview?: ReplyPreviewItem | null;
  reactions?: Record<string, ("visitor" | "owner")[]>;
  attachments?: AttachmentItem[];
}

interface ConversationItem {
  id: string;
  visitorName: string;
  visitorEmail?: string | null;
  emailVerified: boolean;
  emailNotificationsEnabled: boolean;
  createdAt: string;
  lastMessageAt: string;
  unreadOwnerCount: number;
  latestMessage?: string;
  isArchived?: boolean;
  isPinned?: boolean;
  metadata?: VisitorMetadata | null;
}

const QUICK_REACTIONS = ["👍", "❤️", "🔥", "🎉", "😂", "😮", "😢", "🙏"];

function getConversationIdFromUrl(initialId?: string): string | null {
  if (initialId) return initialId;
  if (typeof window === "undefined") return null;

  // 1. Pathname: /admin/inbox/<id>
  const pathMatch = window.location.pathname.match(/^\/admin\/inbox\/([^/?#]+)/);
  if (pathMatch && pathMatch[1]) {
    return decodeURIComponent(pathMatch[1]);
  }

  // 2. Hash: /admin/inbox/#<id>
  const hash = window.location.hash.replace(/^#/, "").trim();
  if (hash) {
    return decodeURIComponent(hash);
  }

  // 3. Query param: ?conversationId=<id>
  const queryParam = new URLSearchParams(window.location.search).get("conversationId");
  if (queryParam) {
    return queryParam.trim();
  }

  return null;
}

interface AdminInboxPageProps {
  initialConversationId?: string;
  initialAuthenticated?: boolean;
}

export default function AdminInboxPage({
  initialConversationId,
  initialAuthenticated,
}: AdminInboxPageProps = {}) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(
    typeof initialAuthenticated === "boolean" ? initialAuthenticated : false
  );
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(initialConversationId || null);
  const [openMenuConvId, setOpenMenuConvId] = useState<string | null>(null);
  const [convToDelete, setConvToDelete] = useState<ConversationItem | null>(null);
  const [activeMessages, setActiveMessages] = useState<MessageItem[]>([]);
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "read" | "awaiting_reply" | "archived">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [apiError, setApiError] = useState("");

  // Telegram-style interaction state
  const [replyingTo, setReplyingTo] = useState<MessageItem | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);
  const [showFullPickerForMsgId, setShowFullPickerForMsgId] = useState<string | null>(null);
  const [showComposerEmojiPicker, setShowComposerEmojiPicker] = useState(false);
  const [showDetailsPanel, setShowDetailsPanel] = useState(true);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [copiedToast, setCopiedToast] = useState(false);

  // Attachment upload state
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentItem[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Modals & Viewers
  const [deleteConvModalOpen, setDeleteConvModalOpen] = useState(false);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);
  const [selectedConvIds, setSelectedConvIds] = useState<Set<string>>(new Set());
  const [targetDeleteMsgId, setTargetDeleteMsgId] = useState<string | null>(null);
  const [activeViewerAttachment, setActiveViewerAttachment] = useState<ViewerAttachment | null>(null);
  const [activeViewerList, setActiveViewerList] = useState<ViewerAttachment[]>([]);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messageElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track message scroll container
  const handleContainerScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const threshold = 120;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
  }, []);

  // Dedicated mouse wheel handler
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTop += e.deltaY;
  }, []);

  // Scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    } else {
      messagesEndRef.current?.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }, []);

  // Instagram-style reply navigation
  const handleReplyReferenceClick = useCallback((targetId: string | null | undefined) => {
    if (!targetId) return;
    const container = messagesContainerRef.current;
    const targetEl = messageElementsRef.current.get(targetId);

    setHighlightedMessageId(null);
    requestAnimationFrame(() => {
      setHighlightedMessageId(targetId);
    });

    if (container && targetEl) {
      const containerRect = container.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const isVisible =
        targetRect.top >= containerRect.top &&
        targetRect.bottom <= containerRect.bottom;

      if (!isVisible) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }

    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedMessageId(null);
    }, 1500);
  }, []);

  // Check auth and initial path/hash/query params on load
  useEffect(() => {
    let active = true;
    const verifyAuth = async () => {
      try {
        const res = await fetch("/api/admin/auth/check");
        const data = await res.json();
        if (active) {
          setIsAuthenticated(Boolean(data.authenticated));
          if (!data.authenticated && (data.code === "SESSION_SUPERSEDED" || data.error?.includes("another device"))) {
            setLoginError("Your account was signed in on another device. Please log in again.");
          }
          if (data.authenticated) {
            const targetId = getConversationIdFromUrl(initialConversationId);
            if (targetId) {
              setSelectedConvId(targetId);
              setMobileView("chat");
            }
          }
        }
      } catch {
        if (active) setIsAuthenticated(false);
      }
    };
    verifyAuth();
    return () => {
      active = false;
    };
  }, [initialConversationId]);

  // Listen for browser Back and Forward navigation via hashchange & popstate
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleNavigationChange = () => {
      const currentId = getConversationIdFromUrl();
      if (currentId) {
        setSelectedConvId((prev) => (prev === currentId ? prev : currentId));
        setMobileView("chat");
      } else {
        // Returned to /admin/inbox without an id or hash
        setSelectedConvId(null);
        setActiveMessages([]);
        setMobileView("list");
      }
    };

    window.addEventListener("hashchange", handleNavigationChange);
    window.addEventListener("popstate", handleNavigationChange);

    return () => {
      window.removeEventListener("hashchange", handleNavigationChange);
      window.removeEventListener("popstate", handleNavigationChange);
    };
  }, [isAuthenticated]);

  // Select a conversation and update URL hash/path without reloading page
  const selectConversation = useCallback((convId: string) => {
    const currentId = getConversationIdFromUrl();
    if (selectedConvId === convId && currentId === convId) {
      setMobileView("chat");
      return;
    }

    const isPathRoute = typeof window !== "undefined" && window.location.pathname.startsWith("/admin/inbox/");
    const targetUrl = isPathRoute
      ? `/admin/inbox/${convId}${window.location.search}`
      : `${window.location.pathname}${window.location.search}#${convId}`;

    window.history.pushState({ convId }, "", targetUrl);
    setSelectedConvId(convId);
    setMobileView("chat");
  }, [selectedConvId]);

  // Mobile Back button returns to conversation list and clears path/hash
  const handleMobileBack = useCallback(() => {
    if (typeof window !== "undefined") {
      if (window.location.pathname.startsWith("/admin/inbox/")) {
        window.history.pushState(null, "", `/admin/inbox${window.location.search}`);
      } else if (window.location.hash) {
        window.history.pushState(null, "", `${window.location.pathname}${window.location.search}`);
      }
    }
    setSelectedConvId(null);
    setMobileView("list");
  }, []);

  // Close 3-dot dropdown menu on click outside or Escape key
  useEffect(() => {
    if (!openMenuConvId) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-conversation-menu]")) {
        setOpenMenuConvId(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenMenuConvId(null);
      }
    };

    window.addEventListener("click", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("click", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuConvId]);

  // Fetch conversation list
  const fetchConversations = useCallback(async () => {
    try {
      const q = new URLSearchParams();
      if (activeTab !== "all") q.set("status", activeTab);
      if (searchQuery.trim()) q.set("search", searchQuery.trim());

      const res = await fetch(`/api/admin/live-chat/conversations?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.conversations)) {
          setConversations(data.conversations);
          const currentUrlId = getConversationIdFromUrl(initialConversationId);
          setSelectedConvId((prev) => {
            const targetId = prev || currentUrlId;
            if (targetId) {
              const exists = data.conversations.some((c: ConversationItem) => c.id === targetId);
              if (exists) {
                return targetId;
              } else {
                // If the selected conversation is deleted or no longer exists, clear the invalid selection and return to conversation list
                if (typeof window !== "undefined") {
                  if (window.location.pathname.startsWith("/admin/inbox/")) {
                    window.history.replaceState(null, "", `/admin/inbox${window.location.search}`);
                  } else if (window.location.hash) {
                    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
                  }
                }
                setMobileView("list");
                return null;
              }
            }
            return null;
          });
        }
        setApiError("");
      } else if (res.status === 401) {
        const errJson = await res.json().catch(() => ({}));
        setIsAuthenticated(false);
        if (errJson.code === "SESSION_SUPERSEDED" || errJson.error?.includes("another device")) {
          setLoginError("Your account was signed in on another device. Please log in again.");
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        setApiError(errJson.error || "Failed to load conversations.");
      }
    } catch {
      setApiError("Connection error loading conversations.");
    }
  }, [activeTab, searchQuery, initialConversationId]);

  // Polling conversations & messages
  useEffect(() => {
    if (!isAuthenticated) return;

    let active = true;
    const runPoll = async () => {
      try {
        const q = new URLSearchParams();
        if (activeTab !== "all") q.set("status", activeTab);
        if (searchQuery.trim()) q.set("search", searchQuery.trim());

        const res = await fetch(`/api/admin/live-chat/conversations?${q.toString()}`);
        if (active && res.ok) {
          const data = await res.json();
          if (Array.isArray(data.conversations)) {
            // Anti-flicker: structural comparison for conversations
            setConversations((prev) => {
              if (prev.length === data.conversations.length) {
                let hasChanges = false;
                for (let i = 0; i < prev.length; i++) {
                  const a = prev[i];
                  const b = data.conversations[i];
                  if (
                    a.id !== b.id ||
                    a.unreadOwnerCount !== b.unreadOwnerCount ||
                    a.lastMessageAt !== b.lastMessageAt ||
                    a.latestMessage !== b.latestMessage ||
                    a.visitorName !== b.visitorName ||
                    a.visitorEmail !== b.visitorEmail ||
                    a.isPinned !== b.isPinned ||
                    a.isArchived !== b.isArchived
                  ) {
                    hasChanges = true;
                    break;
                  }
                }
                if (!hasChanges) return prev;
              }
              return data.conversations;
            });

            // Verify if active selection still exists
            const currentUrlId = getConversationIdFromUrl(initialConversationId);
            if (selectedConvId && !data.conversations.some((c: ConversationItem) => c.id === selectedConvId)) {
              setSelectedConvId(null);
              setActiveMessages([]);
              setMobileView("list");
              if (typeof window !== "undefined") {
                if (window.location.pathname.startsWith("/admin/inbox/")) {
                  window.history.replaceState(null, "", `/admin/inbox${window.location.search}`);
                } else if (currentUrlId) {
                  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
                }
              }
            }
          }
        } else if (active && res.status === 401) {
          const errJson = await res.json().catch(() => ({}));
          setIsAuthenticated(false);
          if (errJson.code === "SESSION_SUPERSEDED" || errJson.error?.includes("another device")) {
            setLoginError("Your account was signed in on another device. Please log in again.");
          }
        }
      } catch {}

      if (active && selectedConvId) {
        try {
          const mRes = await fetch(`/api/admin/live-chat/messages?conversationId=${selectedConvId}`);
          if (active && mRes.ok) {
            const mData = await mRes.json();
            if (Array.isArray(mData.messages)) {
              // Anti-flicker: structural comparison for active messages
              setActiveMessages((prev) => {
                const sending = prev.filter((m) => m.id.startsWith("temp_"));
                const backendIds = new Set(mData.messages.map((m: MessageItem) => m.id));
                const remainingSending = sending.filter((m) => !backendIds.has(m.id));
                const merged = [...mData.messages, ...remainingSending];

                if (prev.length === merged.length) {
                  let hasChanges = false;
                  for (let i = 0; i < prev.length; i++) {
                    const a = prev[i];
                    const b = merged[i];
                    if (
                      a.id !== b.id ||
                      a.content !== b.content ||
                      a.readAt !== b.readAt ||
                      a.isDeleted !== b.isDeleted ||
                      a.isEdited !== b.isEdited ||
                      JSON.stringify(a.reactions) !== JSON.stringify(b.reactions) ||
                      (a.attachments?.length || 0) !== (b.attachments?.length || 0)
                    ) {
                      hasChanges = true;
                      break;
                    }
                  }
                  if (!hasChanges) return prev;
                }
                return merged;
              });
            }
          }
        } catch {}
      }
    };

    runPoll();
    const interval = setInterval(runPoll, 3500);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isAuthenticated, selectedConvId, activeTab, searchQuery, initialConversationId]);

  // Load active conversation messages when selectedConvId changes
  useEffect(() => {
    if (!selectedConvId || !isAuthenticated) return;

    let active = true;
    const loadConversation = async () => {
      setIsLoadingMessages(true);
      try {
        const res = await fetch(`/api/admin/live-chat/messages?conversationId=${selectedConvId}`);
        if (active && res.ok) {
          const data = await res.json();
          if (Array.isArray(data.messages)) {
            setActiveMessages(data.messages);
            requestAnimationFrame(() => scrollToBottom(false));
          }
        }
      } catch {
        // Ignored
      } finally {
        if (active) setIsLoadingMessages(false);
      }
    };

    loadConversation();
    return () => {
      active = false;
    };
  }, [selectedConvId, isAuthenticated, scrollToBottom]);

  // Auto-scroll on new message (only if user is already near bottom)
  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollToBottom(true);
    }
  }, [activeMessages.length, scrollToBottom]);

  // Admin login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError("");

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsAuthenticated(true);
        setPasswordInput("");
        const targetId = getConversationIdFromUrl(initialConversationId);
        if (targetId) {
          setSelectedConvId(targetId);
          setMobileView("chat");
        }
        fetchConversations();
      } else {
        setLoginError(data.error || "Invalid password.");
      }
    } catch {
      setLoginError("Network error. Please try again.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Admin logout handler
  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } finally {
      setIsAuthenticated(false);
      setSelectedConvId(null);
      setActiveMessages([]);
    }
  };

  // Send admin reply
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = replyText.trim();
    const hasAttachments = pendingAttachments.length > 0;
    if ((!text && !hasAttachments) || isSendingReply || !selectedConvId) return;

    setIsSendingReply(true);
    const tempId = `temp_owner_${Date.now()}`;
    const optimisticMsg: MessageItem = {
      id: tempId,
      conversationId: selectedConvId,
      senderType: "owner",
      content: text || (hasAttachments ? `[Attached ${pendingAttachments.map((a) => a.fileName).join(", ")}]` : ""),
      createdAt: new Date().toISOString(),
      replyPreview: replyingTo
        ? {
            id: replyingTo.id,
            senderType: replyingTo.senderType,
            content: replyingTo.content,
            snippet: replyingTo.content.slice(0, 80),
          }
        : null,
      attachments: hasAttachments ? [...pendingAttachments] : undefined,
    };

    setActiveMessages((prev) => [...prev, optimisticMsg]);
    setReplyText("");
    setReplyingTo(null);

    // Auto-scroll immediately on reply send
    requestAnimationFrame(() => scrollToBottom(true));

    try {
      const res = await fetch("/api/admin/live-chat/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selectedConvId,
          content: text,
          replyToId: replyingTo ? replyingTo.id : undefined,
          attachmentIds: pendingAttachments.map((a) => a.id),
        }),
      });

      if (res.ok) {
        // Reset pending attachments ONLY on successful send!
        setPendingAttachments([]);
        const data = await res.json();
        setActiveMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...data.message } : m)),
        );
        fetchConversations();
      } else {
        const errJson = await res.json().catch(() => ({}));
        alert(errJson.error || "Failed to deliver reply.");
        setActiveMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
    } catch {
      alert("Network error sending reply.");
      setActiveMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setIsSendingReply(false);
    }
  };

  // Attachment upload (supports multiple files & successive additions)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !selectedConvId) return;

    setUploadError("");
    const oversizedFiles: string[] = [];
    const validFiles: File[] = [];

    files.forEach((file) => {
      const isVideo = file.type.startsWith("video/");
      const maxSize = isVideo ? 50 * 1024 * 1024 : 25 * 1024 * 1024;
      if (file.size > maxSize) {
        oversizedFiles.push(file.name);
      } else {
        validFiles.push(file);
      }
    });

    if (oversizedFiles.length > 0) {
      setUploadError(
        `Oversized: ${oversizedFiles.join(", ")} exceed size limit (25MB docs/images, 50MB video).`
      );
    }

    if (validFiles.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploadingAttachment(true);
    const newAttachments: AttachmentItem[] = [];
    const failedFiles: string[] = [];

    for (const file of validFiles) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("conversationId", selectedConvId);

        const res = await fetch("/api/live-chat/attachments", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (res.ok && data.attachment) {
          newAttachments.push(data.attachment);
        } else {
          failedFiles.push(`${file.name} (${data.error || "upload error"})`);
        }
      } catch {
        failedFiles.push(`${file.name} (network error)`);
      }
    }

    if (newAttachments.length > 0) {
      setPendingAttachments((prev) => [...prev, ...newAttachments]);
    }

    if (failedFiles.length > 0) {
      setUploadError((prev) =>
        prev
          ? `${prev} Failed: ${failedFiles.join(", ")}`
          : `Failed to upload: ${failedFiles.join(", ")}`
      );
    }

    setIsUploadingAttachment(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Toggle emoji reaction
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    setActiveReactionMsgId(null);
    setShowFullPickerForMsgId(null);

    // Optimistic UI update
    setActiveMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const currentReactions = { ...(m.reactions || {}) };
        const users = currentReactions[emoji] ? [...currentReactions[emoji]] : [];
        const hasOwner = users.includes("owner");

        if (hasOwner) {
          const filtered = users.filter((u) => u !== "owner");
          if (filtered.length > 0) {
            currentReactions[emoji] = filtered;
          } else {
            delete currentReactions[emoji];
          }
        } else {
          currentReactions[emoji] = [...users, "owner"];
        }

        return { ...m, reactions: currentReactions };
      }),
    );

    try {
      const res = await fetch("/api/admin/live-chat/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          conversationId: selectedConvId,
          emoji,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.reactions) {
          setActiveMessages((prev) =>
            prev.map((m) => (m.id === messageId ? { ...m, reactions: data.reactions } : m)),
          );
        }
      }
    } catch (e) {
      console.warn("[Admin Reaction Error]:", e);
    }
  };

  // Save edit
  const handleSaveEdit = async (messageId: string) => {
    const text = editText.trim();
    if (!text || !selectedConvId) return;

    try {
      const res = await fetch("/api/admin/live-chat/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          conversationId: selectedConvId,
          content: text,
        }),
      });

      if (res.ok) {
        setActiveMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, content: text, isEdited: true } : m,
          ),
        );
        setEditingMessageId(null);
        setEditText("");
      }
    } catch (e) {
      console.warn("[Admin Edit Error]:", e);
    }
  };

  // Delete message
  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedConvId) return;

    try {
      const res = await fetch("/api/admin/live-chat/messages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          conversationId: selectedConvId,
        }),
      });

      if (res.ok) {
        setActiveMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  isDeleted: true,
                  content: "[Message deleted]",
                  attachments: undefined,
                }
              : m,
          ),
        );
        setTargetDeleteMsgId(null);
      }
    } catch (e) {
      console.warn("[Admin Delete Message Error]:", e);
    }
  };

  // Toggle archive conversation
  const handleToggleArchive = async () => {
    if (!selectedConvId) return;
    const target = conversations.find((c) => c.id === selectedConvId);
    const newArchivedState = !target?.isArchived;

    try {
      const res = await fetch("/api/admin/live-chat/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selectedConvId,
          archive: newArchivedState,
        }),
      });

      if (res.ok) {
        fetchConversations();
      }
    } catch (e) {
      console.warn("[Archive Error]:", e);
    }
  };

  // Toggle Pin state on conversation (supports optimism and re-sorting)
  const handleTogglePin = async (convId: string, currentPinStatus: boolean, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const nextPinStatus = !currentPinStatus;

    // Optimistically update conversation pin state and sort
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.id === convId ? { ...c, isPinned: nextPinStatus } : c
      );
      return updated.sort((a, b) => {
        const aPinned = Boolean(a.isPinned);
        const bPinned = Boolean(b.isPinned);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      });
    });

    try {
      const res = await fetch("/api/admin/live-chat/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: convId,
          isPinned: nextPinStatus,
        }),
      });

      if (!res.ok) {
        // Rollback on server failure
        fetchConversations();
      }
    } catch (err) {
      console.warn("[Toggle Pin Error]:", err);
      fetchConversations();
    }
  };

  // Delete entire conversation (supports selected or targeted conversation from menu)
  const handleDeleteConversation = async () => {
    const targetId = convToDelete?.id || selectedConvId;
    if (!targetId) return;

    try {
      const res = await fetch("/api/admin/live-chat/conversations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: targetId }),
      });

      if (res.ok) {
        setDeleteConvModalOpen(false);
        const deletedId = targetId;
        setConvToDelete(null);

        // Optimistically remove from list
        setConversations((prev) => prev.filter((c) => c.id !== deletedId));

        // Also remove from multi-select if present
        setSelectedConvIds((prev) => {
          if (!prev.has(deletedId)) return prev;
          const next = new Set(prev);
          next.delete(deletedId);
          return next;
        });

        // If the deleted conversation was the currently selected one, clear selection and URL hash
        if (selectedConvId === deletedId) {
          setSelectedConvId(null);
          setActiveMessages([]);
          setMobileView("list");
          if (typeof window !== "undefined") {
            window.history.replaceState(
              null,
              "",
              `${window.location.pathname}${window.location.search}`
            );
          }
        }
        fetchConversations();
      } else {
        const errJson = await res.json().catch(() => ({}));
        alert(errJson.error || "Failed to delete conversation.");
      }
    } catch (e) {
      console.warn("[Delete Conversation Error]:", e);
      alert("Network error while deleting conversation.");
    }
  };

  // Bulk selection controls
  const handleToggleSelect = (convId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setSelectedConvIds((prev) => {
      const next = new Set(prev);
      if (next.has(convId)) {
        next.delete(convId);
      } else {
        next.add(convId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const allIds = new Set(conversations.map((c) => c.id));
    setSelectedConvIds(allIds);
  };

  const handleClearSelection = () => {
    setSelectedConvIds(new Set());
  };

  const handleBulkDeleteConversations = async () => {
    if (selectedConvIds.size === 0 || isBulkDeleting) return;

    setIsBulkDeleting(true);
    setBulkDeleteError(null);

    const idsToDelete = Array.from(selectedConvIds);

    try {
      const res = await fetch("/api/admin/live-chat/conversations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationIds: idsToDelete }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        const deletedIds: string[] = Array.isArray(data.deletedIds) ? data.deletedIds : idsToDelete;
        const failedIds: string[] = Array.isArray(data.failedIds) ? data.failedIds : [];

        // Optimistically remove successful ones from conversations list
        setConversations((prev) => prev.filter((c) => !deletedIds.includes(c.id)));

        // If the active conversation was deleted, clear active view
        if (selectedConvId && deletedIds.includes(selectedConvId)) {
          setSelectedConvId(null);
          setActiveMessages([]);
          setMobileView("list");
          if (typeof window !== "undefined") {
            window.history.replaceState(
              null,
              "",
              `${window.location.pathname}${window.location.search}`
            );
          }
        }

        // Update selected set: remove deleted ones, keep failed ones
        setSelectedConvIds((prev) => {
          const next = new Set<string>();
          for (const id of prev) {
            if (!deletedIds.includes(id)) {
              next.add(id);
            }
          }
          return next;
        });

        if (failedIds.length > 0) {
          setBulkDeleteError(
            `Deleted ${deletedIds.length} conversation(s). Failed to delete ${failedIds.length} conversation(s). Failed items remain selected.`
          );
        } else {
          setBulkDeleteModalOpen(false);
        }

        fetchConversations();
      } else {
        setBulkDeleteError(data.error || "Failed to delete selected conversations.");
      }
    } catch (err) {
      console.warn("[Bulk Delete Error]:", err);
      setBulkDeleteError("Network error while deleting conversations.");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Synchronize selection state when conversations list changes or is filtered
  useEffect(() => {
    setSelectedConvIds((prev) => {
      if (prev.size === 0) return prev;
      const validIds = new Set(conversations.map((c) => c.id));
      const next = new Set<string>();
      for (const id of prev) {
        if (validIds.has(id)) {
          next.add(id);
        }
      }
      return next.size === prev.size ? prev : next;
    });
  }, [conversations]);

  // Export full PDF
  const handleExportPdf = async () => {
    if (!selectedConvId) return;
    setIsExportingPdf(true);

    try {
      const res = await fetch(`/api/admin/live-chat/export-pdf?conversationId=${selectedConvId}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `chat-transcript-${selectedConvId.slice(0, 8)}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert("Failed to export PDF.");
      }
    } catch {
      alert("Error generating PDF export.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Copy text helper
  const handleCopyText = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2000);
    }
  };

  const activeConv = conversations.find((c) => c.id === selectedConvId);
  const pinnedConversations = conversations.filter((c) => Boolean(c.isPinned));
  const unpinnedConversations = conversations.filter((c) => !c.isPinned);

  const renderConversationRow = (conv: ConversationItem) => {
    const isSelected = conv.id === selectedConvId;
    const isBulkSelected = selectedConvIds.has(conv.id);
    const timeString = new Date(conv.lastMessageAt).toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });

    return (
      <div
        key={conv.id}
        role="button"
        tabIndex={0}
        onClick={() => selectConversation(conv.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            selectConversation(conv.id);
          }
        }}
        className={`p-3 transition-colors cursor-pointer flex items-center gap-2.5 text-left group relative ${
          isSelected
            ? "bg-[#2b5278] text-white"
            : isBulkSelected
            ? "bg-cyan-950/40 text-white border-l-2 border-cyan-400"
            : "hover:bg-white/5 text-gray-300"
        }`}
      >
        {/* Bulk Selection Checkbox */}
        <div
          className="shrink-0 flex items-center"
          onClick={(e) => handleToggleSelect(conv.id, e)}
        >
          <button
            type="button"
            aria-label={`Select conversation with ${conv.visitorName || "visitor"}`}
            aria-checked={isBulkSelected}
            role="checkbox"
            className={`w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer ${
              isBulkSelected
                ? "bg-cyan-500 border-cyan-400 text-black shadow-xs shadow-cyan-500/50"
                : selectedConvIds.size > 0
                ? "border-white/40 hover:border-cyan-400 bg-white/5"
                : "border-white/20 opacity-70 md:opacity-0 md:group-hover:opacity-100 hover:border-cyan-400 bg-white/5 focus:opacity-100"
            }`}
          >
            {isBulkSelected && <Check className="w-3 h-3 stroke-[3]" />}
          </button>
        </div>

        {/* Visitor Avatar */}
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-full bg-linear-to-tr from-cyan-600 to-blue-600 flex items-center justify-center font-bold text-white text-xs shadow-sm">
            {conv.visitorName.slice(0, 1).toUpperCase() || "V"}
          </div>
          {conv.emailVerified && (
            <span
              className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#17212b] flex items-center justify-center"
              title="Verified Email"
            >
              <Check className="w-2 h-2 text-black stroke-[3]" />
            </span>
          )}
        </div>

        {/* Metadata & Last Message */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="font-semibold text-xs truncate flex items-center gap-1.5 text-white">
              <span>{conv.visitorName || "Anonymous Visitor"}</span>
              {conv.emailVerified && (
                <ShieldCheck className="w-3 h-3 text-cyan-300 shrink-0" />
              )}
              {conv.isPinned && (
                <span title="Pinned chat">
                  <Pin className="w-3 h-3 text-cyan-400 rotate-45 shrink-0" />
                </span>
              )}
            </span>
            <span className="text-[10px] text-gray-400 font-mono shrink-0 ml-1">
              {timeString}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <p className="text-[11px] text-gray-400 truncate pr-2">
              {conv.latestMessage || "No messages yet"}
            </p>
            {conv.unreadOwnerCount > 0 && (
              <span className="bg-cyan-500 text-black text-[10px] font-bold px-1.5 py-0.2 rounded-full shrink-0 shadow-sm">
                {conv.unreadOwnerCount}
              </span>
            )}
          </div>
        </div>

        {/* Three-Dot Action Button & Dropdown Menu */}
        <div className="relative shrink-0 flex items-center" data-conversation-menu>
          <button
            type="button"
            aria-label={`Options for ${conv.visitorName}`}
            aria-haspopup="menu"
            aria-expanded={openMenuConvId === conv.id}
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenuConvId((prev) => (prev === conv.id ? null : conv.id));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                setOpenMenuConvId((prev) => (prev === conv.id ? null : conv.id));
              }
            }}
            className={`p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer ${
              openMenuConvId === conv.id
                ? "opacity-100 bg-white/10 text-white"
                : "opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
            }`}
            title="Conversation options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Dropdown Menu */}
          {openMenuConvId === conv.id && (
            <div
              role="menu"
              aria-label="Conversation actions"
              className="absolute right-0 top-8 z-40 w-40 bg-[#17212b] border border-white/15 rounded-xl shadow-2xl py-1 text-xs text-gray-200 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                role="menuitem"
                onClick={(e) => {
                  setOpenMenuConvId(null);
                  handleTogglePin(conv.id, Boolean(conv.isPinned), e);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left transition-colors cursor-pointer text-gray-200"
              >
                {conv.isPinned ? (
                  <>
                    <PinOff className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>Unpin chat</span>
                  </>
                ) : (
                  <>
                    <Pin className="w-3.5 h-3.5 text-cyan-400 rotate-45 shrink-0" />
                    <span>Pin chat</span>
                  </>
                )}
              </button>
              <div className="my-1 border-t border-white/10" />
              <button
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuConvId(null);
                  setConvToDelete(conv);
                  setDeleteConvModalOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-red-400 hover:bg-red-500/20 text-left transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span>Delete chat</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Unauthenticated Login Screen
  if (isAuthenticated === false) {
    return (
      <main className="h-dvh max-h-dvh w-full bg-[#0e1621] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[#17212b] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 text-white text-center">
          <div className="w-14 h-14 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400">
            <Lock className="w-6 h-6" />
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight">Admin Live Inbox</h1>
            <p className="text-xs text-gray-400 mt-1">
              Authenticate to manage live visitor chats and replies.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="text-xs font-mono text-gray-400 block mb-1.5">
                Admin Access Password
              </label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter password..."
                className="w-full bg-[#0e1621] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-cyan-400 transition-colors"
                autoFocus
              />
            </div>

            {loginError && (
              <p className="text-red-400 text-xs flex items-center gap-1.5 font-mono">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{loginError}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={isLoggingIn || !passwordInput}
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-2.5 rounded-xl text-sm transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <span>Access Dashboard</span>
              )}
            </button>
          </form>

          <div className="pt-2">
            <Link
              href="/"
              className="text-xs text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-1.5 font-mono"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Portfolio</span>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Loading Session State
  if (isAuthenticated === null) {
    return (
      <main className="h-dvh max-h-dvh w-full bg-[#0e1621] flex items-center justify-center p-4">
        <div className="text-gray-400 text-xs font-mono flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
          <span>Verifying admin session credentials...</span>
        </div>
      </main>
    );
  }

  return (
    <div className="h-dvh max-h-dvh w-full bg-[#0e1621] text-white flex flex-col overflow-hidden font-sans select-none">
      {/* Attachment Fullscreen Viewer Modal */}
      {activeViewerAttachment && (
        <AttachmentViewerModal
          attachment={activeViewerAttachment}
          allAttachments={activeViewerList}
          onClose={() => setActiveViewerAttachment(null)}
          onNavigate={(att) => setActiveViewerAttachment(att as AttachmentItem)}
        />
      )}

      {/* Copied Feedback Toast */}
      {copiedToast && (
        <div className="fixed bottom-24 right-8 z-60 bg-[#17212b] border border-cyan-500/40 text-cyan-300 text-xs px-3 py-1.5 rounded-xl shadow-2xl animate-in fade-in duration-150 font-mono flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5" />
          <span>Copied to clipboard</span>
        </div>
      )}

      {/* Delete Entire Conversation Modal */}
      {deleteConvModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => {
            setDeleteConvModalOpen(false);
            setConvToDelete(null);
          }}
        >
          <div
            className="bg-[#17212b] border border-red-500/30 rounded-2xl p-5 w-full max-w-sm text-center space-y-3.5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Trash2 className="w-8 h-8 text-red-400 mx-auto" />
            <h3 className="text-base font-bold text-white">Delete Chat Conversation?</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              {convToDelete
                ? `Permanently delete the conversation with "${convToDelete.visitorName}" and all of its message history?`
                : "Permanently delete this conversation and all of its message history?"}
              {" "}This action cannot be undone.
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteConvModalOpen(false);
                  setConvToDelete(null);
                }}
                className="px-3.5 py-1.5 rounded-xl text-gray-400 hover:text-white text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConversation}
                className="bg-red-500 hover:bg-red-400 text-white font-bold px-4 py-1.5 rounded-xl text-xs cursor-pointer shadow-md"
              >
                Delete Conversation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Message Modal */}
      {targetDeleteMsgId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#17212b] border border-red-500/30 rounded-2xl p-4 w-full max-w-xs text-center space-y-3 shadow-2xl">
            <Trash2 className="w-7 h-7 text-red-400 mx-auto" />
            <h4 className="text-sm font-bold text-white">Delete Message?</h4>
            <p className="text-xs text-gray-400">
              The content will be replaced with &quot;[Message deleted]&quot;.
            </p>
            <div className="flex justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setTargetDeleteMsgId(null)}
                className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteMessage(targetDeleteMsgId)}
                className="bg-red-500 hover:bg-red-400 text-white font-bold px-4 py-1.5 rounded-lg text-xs cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Conversations Modal */}
      {bulkDeleteModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => {
            if (!isBulkDeleting) {
              setBulkDeleteModalOpen(false);
              setBulkDeleteError(null);
            }
          }}
        >
          <div
            className="bg-[#17212b] border border-red-500/30 rounded-2xl p-5 w-full max-w-sm text-center space-y-3.5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Trash2 className="w-8 h-8 text-red-400 mx-auto" />
            <h3 className="text-base font-bold text-white">
              Delete {selectedConvIds.size} Conversation{selectedConvIds.size === 1 ? "" : "s"}?
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Permanently delete the selected{" "}
              <span className="text-white font-semibold">{selectedConvIds.size}</span>{" "}
              conversation{selectedConvIds.size === 1 ? "" : "s"} and all associated message history? This action cannot be undone.
            </p>

            {bulkDeleteError && (
              <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-[11px] text-left">
                {bulkDeleteError}
              </div>
            )}

            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={() => {
                  setBulkDeleteModalOpen(false);
                  setBulkDeleteError(null);
                }}
                className="px-3.5 py-1.5 rounded-xl text-gray-400 hover:text-white text-xs cursor-pointer disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBulkDeleting || selectedConvIds.size === 0}
                onClick={handleBulkDeleteConversations}
                className="bg-red-500 hover:bg-red-400 text-white font-bold px-4 py-1.5 rounded-xl text-xs cursor-pointer shadow-md disabled:opacity-50 flex items-center gap-1.5"
              >
                {isBulkDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Selected ({selectedConvIds.size})</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main 3-Panel Layout Container */}
      <div className="flex-1 flex min-h-0 h-full overflow-hidden">
        {/* PANEL 1: CONVERSATIONS SIDEBAR */}
        <aside
          className={`w-full md:w-80 lg:w-88 border-r border-white/10 bg-[#17212b] flex flex-col shrink-0 min-h-0 h-full ${
            mobileView === "chat" ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Sidebar Top Header */}
          <div className="p-3.5 border-b border-white/10 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-xs">
                  G
                </div>
                <div>
                  <h1 className="text-xs font-bold text-white tracking-wide">Live Support Inbox</h1>
                  <span className="text-[10px] text-gray-400 font-mono">Ganganathan</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Link
                  href="/admin/login-info"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-cyan-400 hover:bg-white/5 transition-colors"
                  title="Session History & Login Info"
                >
                  <ShieldCheck className="w-4 h-4" />
                </Link>
                <Link
                  href="/admin/commands"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-cyan-400 hover:bg-white/5 transition-colors"
                  title="Admin Commands Console"
                >
                  <Terminal className="w-4 h-4" />
                </Link>
                <Link
                  href="/"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                  title="View Portfolio"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Telegram Search Bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full bg-[#0e1621] border border-white/10 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder:text-gray-500 outline-none focus:border-cyan-400 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2 text-gray-400 hover:text-white p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Filter Tabs Row */}
            <div className="flex gap-1 overflow-x-auto custom-scrollbar pb-0.5 select-none">
              {(
                [
                  { id: "all", label: "All", icon: Inbox },
                  { id: "unread", label: "Unread", icon: Mail },
                  { id: "awaiting_reply", label: "Awaiting", icon: Clock },
                  { id: "read", label: "Read", icon: CheckCheck },
                  { id: "archived", label: "Archived", icon: Archive },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 shrink-0 transition-colors cursor-pointer ${
                      isActive
                        ? "bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Quick Bulk Select trigger when 0 selected */}
            {conversations.length > 0 && selectedConvIds.size === 0 && (
              <div className="flex items-center justify-between pt-1 text-[10px] text-gray-400 select-none">
                <span className="font-mono">
                  {conversations.length} conversation{conversations.length === 1 ? "" : "s"}
                </span>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="hover:text-cyan-300 transition-colors font-mono cursor-pointer flex items-center gap-1 text-[10px]"
                >
                  <CheckSquare className="w-3 h-3" />
                  <span>Select all</span>
                </button>
              </div>
            )}
          </div>

          {/* Multi-Select Action Bar (Active Selection) */}
          {selectedConvIds.size > 0 && (
            <div className="px-3.5 py-2 bg-[#101b26] border-b border-cyan-500/30 flex items-center justify-between text-xs animate-in fade-in duration-150 shrink-0 select-none">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-cyan-300 font-bold text-[11px] truncate">
                  {selectedConvIds.size} of {conversations.length} selected
                </span>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-[11px] text-gray-400 hover:text-white underline cursor-pointer shrink-0"
                >
                  Clear
                </button>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {selectedConvIds.size < conversations.length && (
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-[10px] px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white cursor-pointer font-mono"
                  >
                    Select All
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setBulkDeleteError(null);
                    setBulkDeleteModalOpen(true);
                  }}
                  disabled={isBulkDeleting}
                  className="text-[11px] px-2.5 py-1 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 flex items-center gap-1 font-semibold cursor-pointer transition-colors shadow-xs"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete ({selectedConvIds.size})</span>
                </button>
              </div>
            </div>
          )}

          {/* Conversations Scroll List */}
          <div
            className="flex-1 min-h-0 overflow-y-auto custom-scrollbar settings-scrollbar overscroll-contain divide-y divide-white/5"
            data-lenis-prevent
            data-lenis-prevent-touch
          >
            {apiError ? (
              <div className="p-6 text-center text-xs text-amber-300 space-y-2">
                <AlertCircle className="w-5 h-5 mx-auto text-amber-400" />
                <p>{apiError}</p>
                <button
                  type="button"
                  onClick={fetchConversations}
                  className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 cursor-pointer font-mono"
                >
                  Retry
                </button>
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-xs space-y-1">
                <Inbox className="w-6 h-6 mx-auto opacity-40 mb-2" />
                <p className="font-semibold text-gray-400">No conversations</p>
                <p className="text-[11px]">
                  {searchQuery ? "No matches found." : "Visitors who reach out will appear here."}
                </p>
              </div>
            ) : (
              <>
                {/* Pinned section at the top if any pinned conversations exist */}
                {pinnedConversations.length > 0 && (
                  <div className="space-y-0.5">
                    <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5 select-none bg-white/[0.02]">
                      <Pin className="w-2.5 h-2.5 rotate-45" />
                      <span>Pinned Chats ({pinnedConversations.length})</span>
                    </div>
                    {pinnedConversations.map((conv) => renderConversationRow(conv))}
                  </div>
                )}

                {/* Unpinned section */}
                {pinnedConversations.length > 0 && unpinnedConversations.length > 0 && (
                  <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 select-none bg-white/[0.02] border-t border-white/5 mt-1">
                    <span>All Conversations ({unpinnedConversations.length})</span>
                  </div>
                )}

                {unpinnedConversations.map((conv) => renderConversationRow(conv))}
              </>
            )}
          </div>
        </aside>

        {/* PANEL 2: CONVERSATION VIEW & CHAT WINDOW */}
        <section
          className={`flex-1 flex flex-col bg-[#0e1621] ${
            mobileView === "list" ? "hidden md:flex" : "flex"
          }`}
        >
          {activeConv ? (
            <>
              {/* Active Chat Top Header */}
              <div className="px-4 py-3 border-b border-white/10 bg-[#17212b] flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-3">
                  {/* Mobile Back to List Button */}
                  <button
                    type="button"
                    onClick={handleMobileBack}
                    className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-white cursor-pointer"
                    title="Back to conversation list"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <div className="w-9 h-9 rounded-full bg-linear-to-tr from-cyan-600 to-blue-600 flex items-center justify-center font-bold text-white text-xs shrink-0">
                    {activeConv.visitorName.slice(0, 1).toUpperCase()}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h2 className="text-sm font-semibold text-white">
                        {activeConv.visitorName || "Visitor"}
                      </h2>
                      {activeConv.emailVerified ? (
                        <span className="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" /> Verified
                        </span>
                      ) : activeConv.visitorEmail ? (
                        <span className="text-[10px] bg-amber-950/80 text-amber-300 border border-amber-800/60 px-2 py-0.5 rounded-full font-mono">
                          Unverified Email
                        </span>
                      ) : (
                        <span className="text-[10px] bg-gray-900 text-gray-400 border border-gray-800 px-2 py-0.5 rounded-full font-mono">
                          Anonymous Guest
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 font-mono">
                      {activeConv.visitorEmail || "Guest browser session"}
                    </p>
                  </div>
                </div>

                {/* Quick Actions Header Toolbar */}
                <div className="flex items-center gap-1">
                  {/* PDF Export */}
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    disabled={isExportingPdf}
                    className="p-2 rounded-lg text-gray-400 hover:text-cyan-300 hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-1 text-xs"
                    title="Export Full Transcript to A4 PDF"
                  >
                    {isExportingPdf ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                    ) : (
                      <FileDown className="w-4 h-4" />
                    )}
                    <span className="hidden lg:inline text-[11px] font-mono">PDF Export</span>
                  </button>

                  {/* Pin / Unpin Toggle */}
                  <button
                    type="button"
                    onClick={(e) => handleTogglePin(activeConv.id, Boolean(activeConv.isPinned), e)}
                    className={`p-2 rounded-lg transition-colors cursor-pointer ${
                      activeConv.isPinned
                        ? "text-cyan-400 bg-cyan-500/10"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                    title={activeConv.isPinned ? "Unpin Conversation" : "Pin Conversation"}
                  >
                    {activeConv.isPinned ? (
                      <PinOff className="w-4 h-4" />
                    ) : (
                      <Pin className="w-4 h-4 rotate-45" />
                    )}
                  </button>

                  {/* Archive Toggle */}
                  <button
                    type="button"
                    onClick={handleToggleArchive}
                    className={`p-2 rounded-lg transition-colors cursor-pointer ${
                      activeConv.isArchived
                        ? "text-amber-400 bg-amber-500/10"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                    title={activeConv.isArchived ? "Unarchive Conversation" : "Archive Conversation"}
                  >
                    <Archive className="w-4 h-4" />
                  </button>

                  {/* Delete Conversation */}
                  <button
                    type="button"
                    onClick={() => {
                      setConvToDelete(activeConv);
                      setDeleteConvModalOpen(true);
                    }}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer"
                    title="Delete Conversation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {/* Toggle Details Panel */}
                  <button
                    type="button"
                    onClick={() => setShowDetailsPanel(!showDetailsPanel)}
                    className={`hidden xl:flex p-2 rounded-lg transition-colors cursor-pointer ${
                      showDetailsPanel
                        ? "text-cyan-300 bg-white/10"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                    title="Toggle Visitor Details"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Telegram Message Stream */}
              <div
                ref={messagesContainerRef}
                onScroll={handleContainerScroll}
                onWheel={handleWheel}
                data-lenis-prevent
                className="flex-1 min-h-0 overscroll-contain p-4 overflow-y-auto custom-scrollbar space-y-3 bg-[#0e1621]"
              >
                {isLoadingMessages ? (
                  <div className="h-full flex items-center justify-center text-gray-500 text-xs font-mono">
                    <RefreshCw className="w-4 h-4 animate-spin mr-2 text-cyan-400" />
                    <span>Loading conversation history...</span>
                  </div>
                ) : activeMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-500 text-xs">
                    No messages in this conversation yet.
                  </div>
                ) : (
                  activeMessages.map((m, idx) => {
                    const isOwner = m.senderType === "owner";
                    const isEditing = editingMessageId === m.id;

                    // Date divider logic
                    const currentDate = new Date(m.createdAt).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });
                    const prevDate =
                      idx > 0
                        ? new Date(activeMessages[idx - 1].createdAt).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "";
                    const showDateHeader = currentDate !== prevDate;

                    return (
                      <React.Fragment key={m.id}>
                        {showDateHeader && (
                          <div className="flex justify-center my-3 select-none">
                            <span className="bg-[#17212b]/80 border border-white/5 text-gray-400 text-[10px] font-semibold px-3 py-0.5 rounded-full shadow-xs">
                              {currentDate}
                            </span>
                          </div>
                        )}

                        <div
                          key={m.id}
                          ref={(el) => {
                            if (el) {
                              messageElementsRef.current.set(m.id, el);
                            } else {
                              messageElementsRef.current.delete(m.id);
                            }
                          }}
                          className={`flex flex-col group relative transition-all duration-300 rounded-xl ${
                            highlightedMessageId === m.id
                              ? "bg-cyan-500/20 ring-2 ring-cyan-400 p-1.5"
                              : ""
                          } ${
                            isOwner ? "items-end" : "items-start"
                          }`}
                        >
                          {/* Quoted Reply Reference */}
                          {m.replyPreview && (
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => handleReplyReferenceClick(m.replyToId || m.replyPreview?.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  handleReplyReferenceClick(m.replyToId || m.replyPreview?.id);
                                }
                              }}
                              className={`mb-0.5 text-[11px] px-2.5 py-1 rounded-t-xl bg-black/30 hover:bg-black/50 transition-colors border-l-2 max-w-[85%] truncate flex items-center gap-1.5 cursor-pointer select-none ${
                                isOwner
                                  ? "border-purple-400 text-purple-200 mr-1"
                                  : "border-cyan-300 text-cyan-200 ml-1"
                              }`}
                              title="Click to view replied message"
                            >
                              <Reply className="w-3 h-3 rotate-180 shrink-0 opacity-70" />
                              <span className="font-bold shrink-0">
                                {m.replyPreview.senderType === "owner" ? "Ganganathan" : "Visitor"}:
                              </span>
                              <span className="truncate opacity-90">
                                {m.replyPreview.snippet || m.replyPreview.content}
                              </span>
                            </div>
                          )}

                          {/* Bubble */}
                          {(() => {
                            const isDeletedByVisitor = Boolean(m.isDeleted && (m.deletedBy === "visitor" || (!m.deletedBy && m.senderType === "visitor")));
                            const isDeletedByOwner = Boolean(m.isDeleted && m.deletedBy === "owner");

                            return (
                              <div
                                className={`p-3 rounded-2xl text-xs sm:text-[13px] max-w-[85%] md:max-w-[75%] break-words leading-relaxed shadow-sm ${
                                  isOwner
                                    ? isDeletedByOwner
                                      ? "italic opacity-60 bg-white/5 text-gray-400 rounded-br-xs"
                                      : "bg-purple-700/85 text-white rounded-br-xs"
                                    : isDeletedByVisitor
                                    ? "bg-red-950/25 text-gray-100 rounded-bl-xs border border-red-500/40 shadow-xs shadow-red-950/30"
                                    : m.isDeleted
                                    ? "italic opacity-60 bg-white/5 text-gray-400 rounded-bl-xs"
                                    : "bg-[#182533] text-gray-100 rounded-bl-xs border border-white/5"
                                }`}
                              >
                                {isDeletedByVisitor && (
                                  <div className="flex items-center gap-1.5 px-2 py-0.5 mb-2 rounded bg-red-500/20 border border-red-500/30 text-red-300 text-[10px] font-semibold tracking-wide w-fit select-none">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                    <span>Deleted by visitor</span>
                                    {m.deletedAt && (
                                      <span className="text-[9px] text-red-400/80 font-mono ml-1">
                                        {new Date(m.deletedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {isEditing ? (
                                  <div className="space-y-2 min-w-[220px]">
                                    <textarea
                                      value={editText}
                                      onChange={(e) => setEditText(e.target.value)}
                                      className="w-full bg-[#0e1621] border border-cyan-400 rounded-lg p-2 text-white text-xs outline-none"
                                      rows={2}
                                      autoFocus
                                    />
                                    <div className="flex justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setEditingMessageId(null)}
                                        className="text-[10px] px-2.5 py-1 rounded bg-white/10 text-gray-300 hover:text-white cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSaveEdit(m.id)}
                                        className="text-[10px] px-3 py-1 rounded bg-cyan-400 text-black font-bold hover:bg-cyan-300 cursor-pointer"
                                      >
                                        Save
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <span>{m.content}</span>
                                    {m.isEdited && !m.isDeleted && (
                                      <span className="text-[10px] text-gray-300/80 font-mono ml-1.5 opacity-80">
                                        (edited)
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Attachments Display */}
                                {m.attachments && m.attachments.length > 0 && (!m.isDeleted || isDeletedByVisitor) && (() => {
                                  const hasMultiple = m.attachments.length > 1;
                                  const isCompact = m.attachments.length > 2;
                                  const visibleAttachments = isCompact ? m.attachments.slice(0, 2) : m.attachments;
                                  const remainingCount = m.attachments.length - 2;

                                  return (
                                    <div className="mt-2.5 pt-2 border-t border-white/10 space-y-1.5">
                                      {/* If multiple attachments, show Download All */}
                                      {hasMultiple && (
                                        <div className="flex items-center justify-between text-[11px] text-gray-400 pb-1 px-1">
                                          <span className="font-mono text-[10px]">{m.attachments.length} files attached</span>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveViewerAttachment(m.attachments![0]);
                                              setActiveViewerList(m.attachments!);
                                            }}
                                            className="text-cyan-300 hover:underline flex items-center gap-1 font-mono font-bold cursor-pointer"
                                          >
                                            <Download className="w-3 h-3" />
                                            <span>Download All</span>
                                          </button>
                                        </div>
                                      )}

                                      {/* Responsive Grid for multiple attachments */}
                                      <div className={hasMultiple ? "grid grid-cols-2 gap-1.5" : "flex flex-col gap-1.5"}>
                                        {visibleAttachments.map((att, attIdx) => {
                                          const mime = att.mimeType.toLowerCase();
                                          const isImg = mime.startsWith("image/");
                                          const isVid = mime.startsWith("video/");
                                          const isAud = mime.startsWith("audio/");
                                          const isPdf = mime === "application/pdf" || att.fileName.toLowerCase().endsWith(".pdf");
                                          const streamUrl = `/api/live-chat/attachments/${att.id}`;
                                          const downloadUrl = `${streamUrl}?download=true`;
                                          const isSecondWithRemaining = isCompact && attIdx === 1 && remainingCount > 0;

                                          return (
                                            <div
                                              key={att.id}
                                              className="relative bg-black/40 rounded-xl p-2 border border-white/10 flex flex-col gap-1.5 overflow-hidden group/card hover:border-cyan-500/40 transition-colors"
                                            >
                                              {isSecondWithRemaining && (
                                                <div
                                                  role="button"
                                                  tabIndex={0}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveViewerAttachment(m.attachments![1]);
                                                    setActiveViewerList(m.attachments!);
                                                  }}
                                                  onKeyDown={(e) => {
                                                    if (e.key === "Enter" || e.key === " ") {
                                                      e.preventDefault();
                                                      setActiveViewerAttachment(m.attachments![1]);
                                                      setActiveViewerList(m.attachments!);
                                                    }
                                                  }}
                                                  className="absolute inset-0 z-20 bg-black/75 hover:bg-black/65 transition-colors backdrop-blur-xs flex flex-col items-center justify-center text-white cursor-pointer select-none rounded-xl"
                                                  title={`View ${remainingCount} more attachments`}
                                                >
                                                  <span className="text-xl font-bold font-mono text-cyan-300">+{remainingCount}</span>
                                                  <span className="text-[10px] text-gray-200 uppercase tracking-wider font-semibold">more</span>
                                                </div>
                                              )}

                                              {isImg && (
                                                <div
                                                  className="relative group/img overflow-hidden rounded-lg cursor-pointer max-h-48 flex items-center justify-center bg-black/60"
                                                  onClick={() => {
                                                    setActiveViewerAttachment(att);
                                                    setActiveViewerList(m.attachments || []);
                                                  }}
                                                >
                                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                                  <img
                                                    src={streamUrl}
                                                    alt={att.fileName}
                                                    onLoad={() => {
                                                      if (isNearBottomRef.current) {
                                                        scrollToBottom(false);
                                                      }
                                                    }}
                                                    className="max-h-48 max-w-full rounded-lg object-contain hover:scale-102 transition-transform"
                                                  />
                                                  <button
                                                    type="button"
                                                    aria-label="View Fullscreen"
                                                    className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/70 text-white opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer"
                                                  >
                                                    <Maximize2 className="w-3.5 h-3.5" />
                                                  </button>
                                                </div>
                                              )}

                                              {isVid && (
                                                <div
                                                  className="relative rounded-lg overflow-hidden bg-black max-h-48 cursor-pointer group/vid"
                                                  onClick={() => {
                                                    setActiveViewerAttachment(att);
                                                    setActiveViewerList(m.attachments || []);
                                                  }}
                                                >
                                                  <video
                                                    className="max-h-48 w-full rounded-lg object-contain bg-black"
                                                    preload="metadata"
                                                  >
                                                    <source src={streamUrl} type={att.mimeType} />
                                                  </video>
                                                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover/vid:bg-black/20 transition-colors">
                                                    <div className="w-10 h-10 rounded-full bg-cyan-500/90 text-black flex items-center justify-center font-bold shadow-lg">
                                                      ▶
                                                    </div>
                                                  </div>
                                                </div>
                                              )}

                                              {isAud && (
                                                <audio controls className="w-full mt-1">
                                                  <source src={streamUrl} type={att.mimeType} />
                                                  Your browser does not support audio playback.
                                                </audio>
                                              )}

                                              {!isImg && !isVid && !isAud && (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setActiveViewerAttachment(att);
                                                    setActiveViewerList(m.attachments || []);
                                                  }}
                                                  className="flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-left w-full cursor-pointer"
                                                >
                                                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                                                    {isPdf ? (
                                                      <FileText className="w-4 h-4 text-red-400" />
                                                    ) : (
                                                      <FileText className="w-4 h-4" />
                                                    )}
                                                  </div>
                                                  <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-mono text-white truncate font-medium">{att.fileName}</p>
                                                    <p className="text-[10px] text-gray-400 font-mono">
                                                      {Math.round(att.fileSize / 1024)} KB
                                                    </p>
                                                  </div>
                                                </button>
                                              )}

                                              <div className="flex items-center justify-between text-[11px] text-gray-300 pt-0.5">
                                                <span className="truncate max-w-[130px] font-mono flex items-center gap-1 text-[10px]">
                                                  <FileText className="w-3 h-3 opacity-70 shrink-0" />
                                                  <span className="truncate">{att.fileName}</span>
                                                </span>
                                                <a
                                                  href={downloadUrl}
                                                  download={att.fileName}
                                                  className="text-cyan-300 hover:underline font-semibold flex items-center gap-1 shrink-0 ml-1 text-[10px]"
                                                  title="Download attachment"
                                                >
                                                  <Download className="w-3 h-3" />
                                                  <span>Save</span>
                                                </a>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>

                                      {/* Compact "Click to view all" bar for >2 attachments */}
                                      {isCompact && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveViewerAttachment(m.attachments![0]);
                                            setActiveViewerList(m.attachments!);
                                          }}
                                          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-black/40 hover:bg-black/60 border border-white/10 text-cyan-300 hover:text-cyan-200 text-xs font-mono transition-colors cursor-pointer select-none"
                                        >
                                          <Images className="w-3.5 h-3.5 text-cyan-400" />
                                          <span>Click to view all {m.attachments.length} attachments</span>
                                        </button>
                                      )}
                                    </div>
                                  );
                                })()}

                            {/* Timestamp & Status in Bubble Corner */}
                            <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-gray-300/80 font-mono select-none">
                              <span>
                                {new Date(m.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              {isOwner && (
                                <span>
                                  {m.readAt ? (
                                    <span title="Seen by visitor">
                                      <CheckCheck className="w-3.5 h-3.5 text-cyan-300 inline" />
                                    </span>
                                  ) : (
                                    <span title="Sent">
                                      <Check className="w-3.5 h-3.5 text-gray-300 inline" />
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                          {/* Multi-Emoji Reaction Pills Row */}
                          {m.reactions && Object.keys(m.reactions).length > 0 && (
                            <div className="flex gap-1 mt-1 flex-wrap items-center">
                              {Object.entries(m.reactions).map(([emoji, users]) => {
                                const isOwnerReacted = users.includes("owner");
                                const userNames = users.map((u) => (u === "owner" ? "Ganganathan" : "Visitor")).join(", ");

                                return (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => handleToggleReaction(m.id, emoji)}
                                    className={`text-xs px-2 py-0.5 rounded-full border transition-all cursor-pointer flex items-center gap-1 shadow-xs ${
                                      isOwnerReacted
                                        ? "bg-purple-900/60 border-purple-400 text-purple-200 font-bold scale-105"
                                        : "bg-[#17212b] border-white/10 text-gray-300 hover:text-white hover:border-white/20"
                                    }`}
                                    title={`Reacted by: ${userNames}`}
                                  >
                                    <span className="text-sm">{emoji}</span>
                                    <span className="font-mono text-[10px]">{users.length}</span>
                                  </button>
                                );
                              })}

                              {/* Plus reaction button */}
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveReactionMsgId(activeReactionMsgId === m.id ? null : m.id)
                                }
                                className="p-1 rounded-full bg-[#17212b] border border-white/10 text-gray-400 hover:text-cyan-300 hover:border-cyan-400 transition-colors cursor-pointer"
                                title="Add reaction"
                              >
                                <SmilePlus className="w-3 h-3" />
                              </button>
                            </div>
                          )}

                          {/* Hover Actions Menu */}
                          {!m.isDeleted && (
                            <div className="opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-1 px-1 text-gray-400">
                              <button
                                type="button"
                                onClick={() => setReplyingTo(m)}
                                className="p-1 rounded-md hover:bg-white/10 hover:text-cyan-300 transition-colors cursor-pointer"
                                title="Reply with quote"
                              >
                                <Reply className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveReactionMsgId(activeReactionMsgId === m.id ? null : m.id)
                                }
                                className="p-1 rounded-md hover:bg-white/10 hover:text-yellow-400 transition-colors cursor-pointer"
                                title="React"
                              >
                                <SmilePlus className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyText(m.content)}
                                className="p-1 rounded-md hover:bg-white/10 hover:text-gray-200 transition-colors cursor-pointer"
                                title="Copy text"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              {isOwner && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingMessageId(m.id);
                                    setEditText(m.content);
                                  }}
                                  className="p-1 rounded-md hover:bg-white/10 hover:text-blue-400 transition-colors cursor-pointer"
                                  title="Edit message"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setTargetDeleteMsgId(m.id)}
                                className="p-1 rounded-md hover:bg-white/10 hover:text-red-400 transition-colors cursor-pointer"
                                title="Delete message"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          {/* Quick Reactions Bar */}
                          {activeReactionMsgId === m.id && (
                            <div className="relative mt-1 z-30">
                              <div className="flex items-center gap-1 p-1 bg-[#17212b] border border-white/15 rounded-full shadow-2xl animate-in fade-in zoom-in-95 duration-100">
                                {QUICK_REACTIONS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => handleToggleReaction(m.id, emoji)}
                                    className="w-7 h-7 rounded-full flex items-center justify-center text-base hover:scale-130 transition-transform cursor-pointer hover:bg-white/10"
                                    title={`React with ${emoji}`}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveReactionMsgId(null);
                                    setShowFullPickerForMsgId(m.id);
                                  }}
                                  className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-cyan-300 hover:bg-white/10 transition-colors cursor-pointer"
                                  title="More emojis"
                                >
                                  <Smile className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Full Categorized Emoji Picker Drawer */}
                          {showFullPickerForMsgId === m.id && (
                            <div className="relative mt-2 z-40">
                              <TelegramEmojiPicker
                                mode="reaction"
                                currentReactions={Object.keys(m.reactions || {})}
                                onSelect={(emoji) => handleToggleReaction(m.id, emoji)}
                                onClose={() => setShowFullPickerForMsgId(null)}
                              />
                            </div>
                          )}
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Telegram Composer Footer */}
              <div className="p-3 border-t border-white/10 bg-[#17212b] space-y-2 relative">
                {/* Full Composer Emoji Picker Drawer */}
                {showComposerEmojiPicker && (
                  <div className="absolute bottom-16 left-3 z-50">
                    <TelegramEmojiPicker
                      mode="composer"
                      onSelect={(emoji) => {
                        setReplyText((prev) => prev + emoji);
                      }}
                      onClose={() => setShowComposerEmojiPicker(false)}
                    />
                  </div>
                )}

                {/* Quoting Banner */}
                {replyingTo && (
                  <div className="flex items-center justify-between bg-[#0e1621] border-l-3 border-purple-400 rounded-r-xl px-3 py-1.5 text-xs">
                    <div className="flex items-center gap-1.5 truncate">
                      <Reply className="w-3.5 h-3.5 text-purple-400 shrink-0 rotate-180" />
                      <span className="font-semibold text-purple-300 shrink-0">
                        {replyingTo.senderType === "owner" ? "Ganganathan" : "Visitor"}:
                      </span>
                      <span className="text-gray-400 truncate">
                        {replyingTo.content.slice(0, 60)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyingTo(null)}
                      className="text-gray-400 hover:text-white p-0.5 ml-2 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Pending Attachment Pills */}
                {pendingAttachments.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {pendingAttachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-1.5 bg-[#0e1621] border border-cyan-500/30 text-cyan-200 text-xs px-2.5 py-1 rounded-lg"
                      >
                        <Paperclip className="w-3 h-3 text-cyan-400 shrink-0" />
                        <span className="truncate max-w-[140px] font-mono">{att.fileName}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingAttachments((prev) => prev.filter((a) => a.id !== att.id))
                          }
                          className="text-gray-400 hover:text-white cursor-pointer ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {uploadError && (
                  <p className="text-[10px] text-red-400 font-mono flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{uploadError}</span>
                  </p>
                )}

                {/* Input Form Row */}
                <form onSubmit={handleSendReply} className="flex gap-2 items-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  {/* Attachment Button */}
                  <button
                    type="button"
                    disabled={isUploadingAttachment || isSendingReply}
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-xl text-gray-400 hover:text-cyan-300 hover:bg-white/5 transition-colors disabled:opacity-40 cursor-pointer shrink-0"
                    title="Attach file"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>

                  {/* Emoji Picker Button */}
                  <button
                    type="button"
                    onClick={() => setShowComposerEmojiPicker(!showComposerEmojiPicker)}
                    className={`p-2 rounded-xl transition-colors cursor-pointer shrink-0 ${
                      showComposerEmojiPicker
                        ? "text-cyan-400 bg-white/10"
                        : "text-gray-400 hover:text-yellow-400 hover:bg-white/5"
                    }`}
                    title="Insert emoji"
                  >
                    <Smile className="w-5 h-5" />
                  </button>

                  {/* Reply Input */}
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`Reply to ${activeConv.visitorName}...`}
                    disabled={isSendingReply}
                    className="flex-1 bg-[#0e1621] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder:text-gray-500 outline-none border border-white/10 focus:border-cyan-400 transition-colors disabled:opacity-50"
                  />

                  {/* Send Button */}
                  <button
                    type="submit"
                    disabled={isSendingReply || (!replyText.trim() && pendingAttachments.length === 0)}
                    className="w-9 h-9 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0 cursor-pointer shadow-md"
                    title="Send reply"
                  >
                    {isSendingReply ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 ml-0.5" />
                    )}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-500 space-y-2 select-none">
              <Inbox className="w-10 h-10 opacity-30 text-cyan-400" />
              <h3 className="text-sm font-semibold text-gray-300">No Conversation Selected</h3>
              <p className="text-xs text-gray-500 max-w-xs">
                Select a visitor conversation from the left sidebar to read messages and reply in real time.
              </p>
            </div>
          )}
        </section>

        {/* PANEL 3: VISITOR & CONVERSATION DETAILS (DESKTOP) */}
        {showDetailsPanel && activeConv && (
          <aside
            className="hidden xl:flex w-72 lg:w-80 border-l border-white/10 bg-[#17212b] flex-col shrink-0 min-h-0 h-full p-4 space-y-5 overflow-y-auto custom-scrollbar settings-scrollbar overscroll-contain select-none"
            data-lenis-prevent
            data-lenis-prevent-touch
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-xs font-bold text-white tracking-wide">Visitor Information</h3>
              <button
                type="button"
                onClick={() => setShowDetailsPanel(false)}
                className="text-gray-400 hover:text-white p-1 cursor-pointer"
                title="Hide details panel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Profile Card */}
            <div className="text-center space-y-2 pb-4 border-b border-white/10">
              <div className="w-16 h-16 rounded-full bg-linear-to-tr from-cyan-600 to-blue-600 flex items-center justify-center font-bold text-white text-xl mx-auto shadow-md">
                {activeConv.visitorName.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center justify-center gap-1.5">
                  <span>{activeConv.visitorName}</span>
                  {activeConv.emailVerified && (
                    <span title="Verified Session">
                      <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                    </span>
                  )}
                </h4>
                <p className="text-xs text-gray-400 font-mono mt-0.5">
                  {activeConv.visitorEmail || "Anonymous guest session"}
                </p>
              </div>
            </div>

            {/* Metadata Attributes */}
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] text-gray-400 font-mono block">Email Verification Status</span>
                <span className="font-medium text-gray-200">
                  {activeConv.emailVerified ? (
                    <span className="text-emerald-400 font-mono flex items-center gap-1">
                      <Check className="w-3 h-3" /> Verified (OTP Confirmed)
                    </span>
                  ) : activeConv.visitorEmail ? (
                    <span className="text-amber-400 font-mono">Unverified (Pending OTP)</span>
                  ) : (
                    <span className="text-gray-400 font-mono">None (Anonymous)</span>
                  )}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-gray-400 font-mono block">Email Alerts Opt-In</span>
                <span className="font-mono text-gray-300">
                  {activeConv.emailNotificationsEnabled && activeConv.emailVerified ? (
                    <span className="text-emerald-400">Active (Delivered via Resend)</span>
                  ) : (
                    <span className="text-gray-500">Disabled</span>
                  )}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-gray-400 font-mono block">Conversation ID</span>
                <span className="font-mono text-[11px] text-gray-300 break-all select-all">
                  {activeConv.id}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-gray-400 font-mono block">First Contact</span>
                <span className="font-mono text-[11px] text-gray-300">
                  {new Date(activeConv.createdAt).toLocaleString()}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-gray-400 font-mono block">Last Activity</span>
                <span className="font-mono text-[11px] text-gray-300">
                  {new Date(activeConv.lastMessageAt).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Live Chat Telemetry & Device Metadata (Admin Only) */}
            <div className="pt-3 border-t border-white/10 space-y-3 text-xs">
              <div className="flex items-center gap-1.5 text-cyan-400 font-mono text-[10px] uppercase font-bold tracking-wider">
                <Globe className="w-3.5 h-3.5" />
                <span>Visitor Telemetry</span>
              </div>

              {/* Browser */}
              <div>
                <span className="text-[10px] text-gray-400 font-mono block">Browser & Engine</span>
                <span className="font-mono text-[11px] text-gray-200">
                  {activeConv.metadata?.browserFamily ? (
                    <>
                      {activeConv.metadata.browserFamily}
                      {activeConv.metadata.browserVersion ? ` ${activeConv.metadata.browserVersion}` : ""}
                      {activeConv.metadata.browserEngine ? ` (${activeConv.metadata.browserEngine})` : ""}
                    </>
                  ) : (
                    <span className="text-gray-500 italic">Unavailable (Not detected)</span>
                  )}
                </span>
              </div>

              {/* Device Category & OS */}
              <div>
                <span className="text-[10px] text-gray-400 font-mono block">Device & Operating System</span>
                <div className="flex items-center gap-1.5 font-mono text-[11px] text-gray-200 mt-0.5">
                  {activeConv.metadata?.deviceType === "mobile" ? (
                    <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                  ) : activeConv.metadata?.deviceType === "tablet" ? (
                    <Tablet className="w-3.5 h-3.5 text-cyan-400" />
                  ) : (
                    <Laptop className="w-3.5 h-3.5 text-cyan-400" />
                  )}
                  <span className="capitalize">{activeConv.metadata?.deviceType || "Desktop"}</span>
                  <span className="text-gray-500">•</span>
                  <span>
                    {activeConv.metadata?.osFamily || "OS Unavailable"}
                    {activeConv.metadata?.osVersion ? ` ${activeConv.metadata.osVersion}` : ""}
                  </span>
                </div>
              </div>

              {/* Screen & Viewport */}
              <div>
                <span className="text-[10px] text-gray-400 font-mono block">Screen & Viewport</span>
                <span className="font-mono text-[11px] text-gray-300">
                  {activeConv.metadata?.screenResolution ? (
                    <>
                      {activeConv.metadata.screenResolution} Screen
                      {activeConv.metadata.viewportDimensions ? ` (${activeConv.metadata.viewportDimensions} viewport)` : ""}
                    </>
                  ) : activeConv.metadata?.viewportDimensions ? (
                    `${activeConv.metadata.viewportDimensions} viewport`
                  ) : (
                    <span className="text-gray-500 italic">Unavailable (Client omitted)</span>
                  )}
                </span>
              </div>

              {/* Approximate Location */}
              <div>
                <span className="text-[10px] text-gray-400 font-mono block">Approximate Location</span>
                <div className="flex items-start gap-1.5 font-mono text-[11px] text-gray-300 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    {activeConv.metadata?.city || activeConv.metadata?.country ? (
                      <>
                        {[activeConv.metadata.city, activeConv.metadata.region, activeConv.metadata.country].filter(Boolean).join(", ")}
                        <span className="text-[10px] text-gray-500 block">IP-derived, approximate</span>
                      </>
                    ) : (
                      <span className="text-gray-500 italic">
                        {activeConv.metadata?.locationUnavailableReason || "Unavailable (No edge IP-geolocation headers)"}
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Client IP */}
              <div>
                <span className="text-[10px] text-gray-400 font-mono block">Client IP Address</span>
                <span className="font-mono text-[11px] text-amber-300/90 select-all">
                  {activeConv.metadata?.ip || "Unavailable"}
                </span>
              </div>

              {/* Timezone & Language */}
              <div>
                <span className="text-[10px] text-gray-400 font-mono block">Timezone & Language</span>
                <span className="font-mono text-[11px] text-gray-300">
                  {activeConv.metadata?.timezone || "Timezone Unavailable"} • {activeConv.metadata?.deviceLanguage || "en"}
                </span>
              </div>
            </div>

            {/* Admin Actions Card */}
            <div className="pt-2 border-t border-white/10 space-y-2">
              <span className="text-[10px] text-gray-400 font-mono block mb-1">Administrative Actions</span>

              <button
                type="button"
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                className="w-full bg-[#0e1621] hover:bg-white/5 border border-white/10 text-cyan-300 font-medium py-2 px-3 rounded-xl text-xs transition-colors flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <FileDown className="w-4 h-4 text-cyan-400" />
                  <span>{isExportingPdf ? "Generating PDF..." : "Export Transcript (PDF)"}</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              <button
                type="button"
                onClick={(e) => handleTogglePin(activeConv.id, Boolean(activeConv.isPinned), e)}
                className="w-full bg-[#0e1621] hover:bg-white/5 border border-white/10 text-gray-300 font-medium py-2 px-3 rounded-xl text-xs transition-colors flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  {activeConv.isPinned ? (
                    <>
                      <PinOff className="w-4 h-4 text-cyan-400" />
                      <span>Unpin Conversation</span>
                    </>
                  ) : (
                    <>
                      <Pin className="w-4 h-4 text-cyan-400 rotate-45" />
                      <span>Pin Conversation</span>
                    </>
                  )}
                </span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              <button
                type="button"
                onClick={handleToggleArchive}
                className="w-full bg-[#0e1621] hover:bg-white/5 border border-white/10 text-gray-300 font-medium py-2 px-3 rounded-xl text-xs transition-colors flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Archive className="w-4 h-4 text-amber-400" />
                  <span>{activeConv.isArchived ? "Unarchive Conversation" : "Archive Conversation"}</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setConvToDelete(activeConv);
                  setDeleteConvModalOpen(true);
                }}
                className="w-full bg-red-950/20 hover:bg-red-900/30 border border-red-800/40 text-red-300 font-medium py-2 px-3 rounded-xl text-xs transition-colors flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-red-400" />
                  <span>Delete Conversation</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
