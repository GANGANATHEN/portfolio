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
} from "lucide-react";
import TelegramEmojiPicker from "@/components/LiveChat/TelegramEmojiPicker";

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
}

const QUICK_REACTIONS = ["👍", "❤️", "🔥", "🎉", "😂", "😮", "😢", "🙏"];

export default function AdminInboxPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
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
  const [targetDeleteMsgId, setTargetDeleteMsgId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check auth and initial query params on load
  useEffect(() => {
    let active = true;
    const verifyAuth = async () => {
      try {
        const res = await fetch("/api/admin/auth/check");
        const data = await res.json();
        if (active) {
          setIsAuthenticated(Boolean(data.authenticated));
          if (data.authenticated) {
            const urlParams = new URLSearchParams(window.location.search);
            const queryConvId = urlParams.get("conversationId");
            if (queryConvId) {
              setSelectedConvId(queryConvId);
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
  }, []);

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
          setSelectedConvId((prev) => {
            if (prev && data.conversations.some((c: ConversationItem) => c.id === prev)) return prev;
            return data.conversations.length > 0 ? data.conversations[0].id : null;
          });
        }
        setApiError("");
      } else if (res.status === 401) {
        setIsAuthenticated(false);
      } else {
        const errJson = await res.json().catch(() => ({}));
        setApiError(errJson.error || "Failed to load conversations.");
      }
    } catch {
      setApiError("Connection error loading conversations.");
    }
  }, [activeTab, searchQuery]);

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
            setConversations(data.conversations);
          }
        } else if (active && res.status === 401) {
          setIsAuthenticated(false);
        }
      } catch {}

      if (active && selectedConvId) {
        try {
          const mRes = await fetch(`/api/admin/live-chat/messages?conversationId=${selectedConvId}`);
          if (active && mRes.ok) {
            const mData = await mRes.json();
            if (Array.isArray(mData.messages)) {
              setActiveMessages(mData.messages);
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
  }, [isAuthenticated, selectedConvId, activeTab, searchQuery]);

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
  }, [selectedConvId, isAuthenticated]);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length]);

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
      content: text || (hasAttachments ? `[Attached ${pendingAttachments[0].fileName}]` : ""),
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
    setPendingAttachments([]);

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

  // Attachment upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConvId) return;

    setUploadError("");
    setIsUploadingAttachment(true);

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
        setPendingAttachments((prev) => [...prev, data.attachment]);
      } else {
        setUploadError(data.error || "Upload failed.");
      }
    } catch {
      setUploadError("Upload network error.");
    } finally {
      setIsUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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

  // Delete entire conversation
  const handleDeleteConversation = async () => {
    if (!selectedConvId) return;

    try {
      const res = await fetch("/api/admin/live-chat/conversations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selectedConvId }),
      });

      if (res.ok) {
        setDeleteConvModalOpen(false);
        setSelectedConvId(null);
        setActiveMessages([]);
        fetchConversations();
        setMobileView("list");
      }
    } catch (e) {
      console.warn("[Delete Conversation Error]:", e);
    }
  };

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

  // Unauthenticated Login Screen
  if (isAuthenticated === false) {
    return (
      <main className="min-h-screen bg-[#0e1621] flex items-center justify-center p-4">
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
      <main className="min-h-screen bg-[#0e1621] flex items-center justify-center p-4">
        <div className="text-gray-400 text-xs font-mono flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
          <span>Verifying admin session credentials...</span>
        </div>
      </main>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#0e1621] text-white flex flex-col overflow-hidden font-sans select-none">
      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          role="dialog"
          aria-label="Image preview"
          className="fixed inset-0 z-60 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxImage}
              alt="Attachment preview"
              className="max-h-[82vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="flex items-center gap-3 mt-3">
              <a
                href={`${lightboxImage}?download=true`}
                download
                className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </a>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Close (Esc)</span>
              </button>
            </div>
          </div>
        </div>
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#17212b] border border-red-500/30 rounded-2xl p-5 w-full max-w-sm text-center space-y-3.5 shadow-2xl">
            <Trash2 className="w-8 h-8 text-red-400 mx-auto" />
            <h3 className="text-base font-bold text-white">Delete Entire Conversation?</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              This action will permanently delete this conversation and its message history from the active inbox.
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConvModalOpen(false)}
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

      {/* Main 3-Panel Layout Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* PANEL 1: CONVERSATIONS SIDEBAR */}
        <aside
          className={`w-full md:w-80 lg:w-88 border-r border-white/10 bg-[#17212b] flex flex-col shrink-0 ${
            mobileView === "chat" ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Sidebar Top Header */}
          <div className="p-3.5 border-b border-white/10 space-y-3">
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
          </div>

          {/* Conversations Scroll List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-white/5">
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
              conversations.map((conv) => {
                const isSelected = conv.id === selectedConvId;
                const timeString = new Date(conv.lastMessageAt).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                });

                return (
                  <div
                    key={conv.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedConvId(conv.id);
                      setMobileView("chat");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        setSelectedConvId(conv.id);
                        setMobileView("chat");
                      }
                    }}
                    className={`p-3 transition-colors cursor-pointer flex gap-3 text-left ${
                      isSelected
                        ? "bg-[#2b5278] text-white"
                        : "hover:bg-white/5 text-gray-300"
                    }`}
                  >
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
                        <span className="font-semibold text-xs truncate flex items-center gap-1 text-white">
                          <span>{conv.visitorName || "Anonymous Visitor"}</span>
                          {conv.emailVerified && (
                            <ShieldCheck className="w-3 h-3 text-cyan-300 shrink-0" />
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
                  </div>
                );
              })
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
                    onClick={() => setMobileView("list")}
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
                    onClick={() => setDeleteConvModalOpen(true)}
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
              <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-3 bg-[#0e1621]">
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
                          className={`flex flex-col group relative ${
                            isOwner ? "items-end" : "items-start"
                          }`}
                        >
                          {/* Quoted Reply Reference */}
                          {m.replyPreview && (
                            <div
                              className={`mb-0.5 text-[11px] px-2.5 py-1 rounded-t-xl bg-black/30 border-l-2 max-w-[85%] truncate flex items-center gap-1.5 ${
                                isOwner
                                  ? "border-purple-400 text-purple-200 mr-1"
                                  : "border-cyan-300 text-cyan-200 ml-1"
                              }`}
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
                          <div
                            className={`p-3 rounded-2xl text-xs sm:text-[13px] max-w-[85%] md:max-w-[75%] break-words leading-relaxed shadow-sm ${
                              isOwner
                                ? "bg-purple-700/85 text-white rounded-br-xs"
                                : "bg-[#182533] text-gray-100 rounded-bl-xs border border-white/5"
                            } ${m.isDeleted ? "italic opacity-60 bg-white/5 text-gray-400" : ""}`}
                          >
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
                            {m.attachments && m.attachments.length > 0 && !m.isDeleted && (
                              <div className="mt-2.5 pt-2 border-t border-white/10 space-y-2">
                                {m.attachments.map((att) => {
                                  const isImg = att.mimeType.startsWith("image/");
                                  const isVid = att.mimeType.startsWith("video/");
                                  const isAud = att.mimeType.startsWith("audio/");
                                  const streamUrl = `/api/live-chat/attachments/${att.id}`;
                                  const downloadUrl = `${streamUrl}?download=true`;

                                  return (
                                    <div
                                      key={att.id}
                                      className="bg-black/40 rounded-xl p-2 border border-white/10 flex flex-col gap-1.5"
                                    >
                                      {isImg && (
                                        <div className="relative group/img overflow-hidden rounded-lg">
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img
                                            src={streamUrl}
                                            alt={att.fileName}
                                            className="max-h-48 max-w-full rounded-lg object-contain hover:scale-102 transition-transform cursor-pointer"
                                            onClick={() => setLightboxImage(streamUrl)}
                                          />
                                          <button
                                            type="button"
                                            onClick={() => setLightboxImage(streamUrl)}
                                            className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/60 text-white opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer"
                                            title="View Fullscreen"
                                          >
                                            <Maximize2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      )}

                                      {isVid && (
                                        <video
                                          controls
                                          className="max-h-48 max-w-full rounded-lg bg-black"
                                        >
                                          <source src={streamUrl} type={att.mimeType} />
                                          Your browser does not support video playback.
                                        </video>
                                      )}

                                      {isAud && (
                                        <audio controls className="w-full mt-1">
                                          <source src={streamUrl} type={att.mimeType} />
                                          Your browser does not support audio playback.
                                        </audio>
                                      )}

                                      <div className="flex items-center justify-between text-[11px] text-gray-300 pt-0.5">
                                        <span className="truncate max-w-[150px] font-mono flex items-center gap-1">
                                          <FileText className="w-3.5 h-3.5 opacity-70 shrink-0" />
                                          <span className="truncate">{att.fileName}</span>
                                          <span className="opacity-60 text-[10px]">
                                            ({Math.round(att.fileSize / 1024)} KB)
                                          </span>
                                        </span>
                                        <a
                                          href={downloadUrl}
                                          download={att.fileName}
                                          className="text-cyan-300 hover:underline font-semibold flex items-center gap-1 shrink-0 ml-2"
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
                            )}

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
                    accept="image/*,video/mp4,audio/*"
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
          <aside className="hidden xl:flex w-72 lg:w-80 border-l border-white/10 bg-[#17212b] flex-col shrink-0 p-4 space-y-5 overflow-y-auto custom-scrollbar select-none">
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
                onClick={() => setDeleteConvModalOpen(true)}
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
