"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

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

const EMOJI_OPTIONS = ["👍", "❤️", "🔥", "🎉", "🚀", "👀"];

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

  // Advanced features state
  const [replyingTo, setReplyingTo] = useState<MessageItem | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [showEmojiPickerForMsgId, setShowEmojiPickerForMsgId] = useState<string | null>(null);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  // Attachment upload state
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentItem[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Modals
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
            // Check for conversationId query parameter from email notifications
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
            if (prev) return prev;
            return data.conversations.length > 0 ? data.conversations[0].id : null;
          });
        }
      } else if (res.status === 401) {
        setIsAuthenticated(false);
      }
    } catch (e) {
      console.warn("[Admin Inbox] Fetch conversations error:", e);
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
          setConversations((prev) =>
            prev.map((c) => (c.id === selectedConvId ? { ...c, unreadOwnerCount: 0 } : c)),
          );
        }
      } catch (e) {
        console.warn("[Admin Inbox] Error loading active conversation:", e);
      } finally {
        if (active) {
          setIsLoadingMessages(false);
          messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
        }
      }
    };

    loadConversation();
    return () => {
      active = false;
    };
  }, [selectedConvId, isAuthenticated]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length]);

  // Login handler
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
      if (res.ok) {
        setIsAuthenticated(true);
        setPasswordInput("");
        fetchConversations();
      } else {
        setLoginError(data.error || "Invalid password");
      }
    } catch {
      setLoginError("Failed to authenticate.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    setIsAuthenticated(false);
    setConversations([]);
    setActiveMessages([]);
    setSelectedConvId(null);
  };

  // Reply handler
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = replyText.trim();
    const hasAttachments = pendingAttachments.length > 0;

    if ((!text && !hasAttachments) || !selectedConvId || isSendingReply) return;

    setIsSendingReply(true);
    try {
      const res = await fetch("/api/admin/live-chat/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selectedConvId,
          content: text,
          replyToId: replyingTo?.id || null,
          attachmentIds: pendingAttachments.map((a) => a.id),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveMessages((prev) => [...prev, data.message]);
        setReplyText("");
        setReplyingTo(null);
        setPendingAttachments([]);
        fetchConversations();
      }
    } catch (err) {
      console.error("[Admin Reply Exception]:", err);
    } finally {
      setIsSendingReply(false);
    }
  };

  // Attachment upload handler
  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConvId) return;

    setIsUploadingAttachment(true);
    setUploadError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("conversationId", selectedConvId);

    try {
      const res = await fetch("/api/live-chat/attachments", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.attachment) {
        setPendingAttachments((prev) => [...prev, data.attachment]);
      } else {
        setUploadError(data.error || "Failed to upload file.");
      }
    } catch {
      setUploadError("Network error uploading file.");
    } finally {
      setIsUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Edit message handler
  const handleSaveEdit = async (messageId: string) => {
    if (!editText.trim() || !selectedConvId) return;
    try {
      const res = await fetch("/api/admin/live-chat/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          conversationId: selectedConvId,
          content: editText.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, ...data.message } : m)),
        );
        setEditingMessageId(null);
        setEditText("");
      }
    } catch (err) {
      console.error("[Edit Message Error]:", err);
    }
  };

  // Delete message handler
  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedConvId) return;
    try {
      const res = await fetch(
        `/api/admin/live-chat/messages?messageId=${messageId}&conversationId=${selectedConvId}`,
        { method: "DELETE" },
      );

      if (res.ok) {
        setActiveMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, isDeleted: true, content: "[Message deleted]" }
              : m,
          ),
        );
      }
    } catch (err) {
      console.error("[Delete Message Error]:", err);
    } finally {
      setTargetDeleteMsgId(null);
    }
  };

  // Toggle reaction handler
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!selectedConvId) return;
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
        setActiveMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, reactions: data.reactions } : m)),
        );
      }
    } catch (err) {
      console.error("[Reaction Error]:", err);
    } finally {
      setShowEmojiPickerForMsgId(null);
    }
  };

  // Delete entire conversation
  const handleDeleteConversation = async () => {
    if (!selectedConvId) return;
    try {
      const res = await fetch(
        `/api/admin/live-chat/conversations?conversationId=${selectedConvId}`,
        { method: "DELETE" },
      );

      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== selectedConvId));
        setSelectedConvId(null);
        setActiveMessages([]);
        setDeleteConvModalOpen(false);
        setMobileView("list");
      }
    } catch (err) {
      console.error("[Delete Conv Error]:", err);
    }
  };

  // Archive conversation
  const handleToggleArchive = async (isArchived: boolean) => {
    if (!selectedConvId) return;
    try {
      const res = await fetch("/api/admin/live-chat/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selectedConvId,
          isArchived,
        }),
      });

      if (res.ok) {
        setConversations((prev) =>
          prev.map((c) => (c.id === selectedConvId ? { ...c, isArchived } : c)),
        );
      }
    } catch (err) {
      console.error("[Archive Conv Error]:", err);
    }
  };

  // Export full PDF handler
  const handleExportPdf = async () => {
    if (!selectedConvId || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const res = await fetch(`/api/admin/live-chat/export-pdf?conversationId=${selectedConvId}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const activeC = conversations.find((c) => c.id === selectedConvId);
        const namePart = (activeC?.visitorName || "visitor").replace(/[^a-zA-Z0-9_\-]/g, "_");
        a.download = `chat-export-${namePart}-${new Date().toISOString().slice(0, 10)}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        alert("Failed to export PDF.");
      }
    } catch (err) {
      console.error("[Export PDF Error]:", err);
      alert("Error generating PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const activeConv = conversations.find((c) => c.id === selectedConvId);

  // Authentication Loading State
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#050816] flex items-center justify-center text-white font-mono">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-cyan-400 animate-ping" />
          <span>Verifying security credentials...</span>
        </div>
      </div>
    );
  }

  // Login Gate View
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#050816] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#0a0a0c] border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-cyan-400 via-purple-500 to-pink-500" />
          <div className="text-center mb-8">
            <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 bg-cyan-950/40 px-3 py-1 rounded-full border border-cyan-800/40">
              OWNER INBOX
            </span>
            <h1 className="text-2xl font-bold text-white mt-4 tracking-tight">Admin Authentication</h1>
            <p className="text-gray-400 text-xs mt-1">Live portfolio messaging dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1 font-mono">Admin Password</label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-white/5 border border-white/10 focus:border-cyan-400 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors"
              />
            </div>

            {loginError && (
              <p className="text-red-400 text-xs font-mono bg-red-950/30 border border-red-900/50 p-2.5 rounded-lg">
                ⚠️ {loginError}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-linear-to-r from-purple-600 to-cyan-500 hover:opacity-90 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-lg shadow-cyan-500/10 cursor-pointer"
            >
              {isLoggingIn ? "Authenticating..." : "Access Live Inbox"}
            </button>
          </form>

          <div className="text-center mt-6">
            <Link href="/" className="text-xs text-gray-500 hover:text-white transition-colors">
              ← Return to Portfolio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated Owner Inbox Dashboard View
  return (
    <div className="min-h-screen bg-[#050816] text-white flex flex-col font-sans select-none">
      {/* Top Header */}
      <header className="border-b border-white/10 bg-[#07070c]/90 backdrop-blur-md px-4 sm:px-6 py-3.5 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-white text-xs font-mono flex items-center gap-1">
            <span>←</span> <span className="hidden sm:inline">Portfolio</span>
          </Link>
          <span className="text-gray-600">/</span>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h1 className="text-xs sm:text-sm font-bold tracking-wide">Live Visitor Messaging</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {activeConv && (
            <button
              onClick={() => setShowDetailsPanel(!showDetailsPanel)}
              className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1.5 rounded-lg text-gray-300 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Toggle Details Panel"
            >
              <span>ℹ️</span> <span className="hidden sm:inline">Details</span>
            </button>
          )}

          <button
            onClick={handleLogout}
            className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg text-gray-300 hover:text-white transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main 3-Part Responsive Split Layout */}
      <div className="flex-1 flex overflow-hidden max-w-[1920px] w-full mx-auto p-2 sm:p-4 md:p-6 gap-4">
        {/* PANEL 1: Conversation Sidebar */}
        <aside
          className={`${
            mobileView === "list" ? "flex" : "hidden md:flex"
          } w-full md:w-80 lg:w-96 bg-[#0a0a0c] border border-white/10 rounded-2xl flex-col overflow-hidden shrink-0`}
        >
          {/* Search Header */}
          <div className="p-3 border-b border-white/10 space-y-2">
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-gray-500 outline-none focus:border-cyan-400"
            />

            {/* Filter Tabs */}
            <div className="flex gap-1 overflow-x-auto custom-scrollbar pb-1 text-[11px] font-mono">
              {(["all", "unread", "read", "awaiting_reply", "archived"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-2.5 py-1 rounded-lg capitalize whitespace-nowrap transition-colors cursor-pointer ${
                    activeTab === tab
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                  }`}
                >
                  {tab.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-white/5">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-xs">
                No conversations found in &quot;{activeTab}&quot;.
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = conv.id === selectedConvId;
                return (
                  <button
                    key={conv.id}
                    onClick={() => {
                      setSelectedConvId(conv.id);
                      setMobileView("chat");
                    }}
                    className={`w-full text-left p-3.5 transition-colors flex items-start justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? "bg-white/10 border-l-4 border-cyan-400"
                        : "hover:bg-white/5"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-white truncate">
                          {conv.visitorName || "Anonymous Visitor"}
                        </span>
                        {conv.unreadOwnerCount > 0 && (
                          <span className="bg-pink-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                            {conv.unreadOwnerCount} new
                          </span>
                        )}
                        {conv.visitorEmail ? (
                          conv.emailVerified ? (
                            <span className="text-[9px] bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-1.5 py-0.2 rounded font-mono shrink-0">
                              ✓ Verified
                            </span>
                          ) : (
                            <span className="text-[9px] bg-amber-950/80 text-amber-300 border border-amber-800/60 px-1.5 py-0.2 rounded font-mono shrink-0">
                              ⚠️ Unverified
                            </span>
                          )
                        ) : (
                          <span className="text-[9px] bg-gray-900 text-gray-400 border border-gray-800 px-1.5 py-0.2 rounded font-mono shrink-0">
                            Guest
                          </span>
                        )}
                      </div>
                      {conv.visitorEmail && (
                        <p className="text-[11px] text-cyan-400 truncate mt-0.5">
                          {conv.visitorEmail}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 truncate mt-1">
                        {conv.latestMessage || "No messages"}
                      </p>
                    </div>
                    <span className="text-[10px] text-gray-500 font-mono shrink-0">
                      {new Date(conv.lastMessageAt).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* PANEL 2: Main Active Chat Window */}
        <main
          className={`${
            mobileView === "chat" ? "flex" : "hidden md:flex"
          } flex-1 bg-[#0a0a0c] border border-white/10 rounded-2xl flex-col overflow-hidden min-h-[500px]`}
        >
          {activeConv ? (
            <>
              {/* Active Conversation Top Header */}
              <div className="p-3.5 sm:p-4 border-b border-white/10 flex items-center justify-between bg-white/3">
                <div className="flex items-center gap-3">
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => setMobileView("list")}
                    className="md:hidden text-gray-400 hover:text-white p-1 text-sm font-bold cursor-pointer"
                    title="Back to conversation list"
                  >
                    ← Back
                  </button>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm sm:text-base font-bold text-white">
                        {activeConv.visitorName || "Visitor"}
                      </h2>
                      {activeConv.visitorEmail ? (
                        activeConv.emailVerified ? (
                          <span className="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded-full font-mono">
                            ✓ Verified Email
                          </span>
                        ) : (
                          <span className="text-[10px] bg-amber-950/80 text-amber-300 border border-amber-800/60 px-2 py-0.5 rounded-full font-mono">
                            ⚠️ Unverified Email
                          </span>
                        )
                      ) : (
                        <span className="text-[10px] bg-gray-900 text-gray-400 border border-gray-800 px-2 py-0.5 rounded-full font-mono">
                          Anonymous Guest
                        </span>
                      )}

                      {activeConv.emailNotificationsEnabled && activeConv.emailVerified ? (
                        <span className="text-[10px] bg-emerald-950/60 text-emerald-300 border border-emerald-800/50 px-2 py-0.5 rounded-full font-mono">
                          ✉️ Alerts Active
                        </span>
                      ) : (
                        <span className="text-[10px] bg-gray-900 text-gray-400 border border-gray-800 px-2 py-0.5 rounded-full font-mono">
                          No Email Alerts
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">
                      {activeConv.visitorEmail || "Guest session (no email)"}
                    </p>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportPdf}
                    disabled={isExportingPdf}
                    className="text-xs bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800/50 px-2.5 py-1.5 rounded-lg text-cyan-300 flex items-center gap-1 font-mono cursor-pointer"
                    title="Export Full Conversation to PDF"
                  >
                    <span>📄</span>{" "}
                    <span className="hidden sm:inline">
                      {isExportingPdf ? "Generating..." : "PDF Export"}
                    </span>
                  </button>

                  <button
                    onClick={() => setDeleteConvModalOpen(true)}
                    className="text-xs bg-red-950/30 hover:bg-red-900/40 border border-red-800/40 px-2 py-1.5 rounded-lg text-red-300 transition-colors cursor-pointer"
                    title="Delete Conversation"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* Messages History Stream */}
              <div className="flex-1 p-3 sm:p-4 overflow-y-auto custom-scrollbar space-y-3.5">
                {isLoadingMessages ? (
                  <div className="h-full flex items-center justify-center text-gray-500 text-xs font-mono">
                    Loading messages...
                  </div>
                ) : activeMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-500 text-xs">
                    No messages in this conversation yet.
                  </div>
                ) : (
                  activeMessages.map((m) => {
                    const isOwner = m.senderType === "owner";
                    const isEditing = editingMessageId === m.id;

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col group relative ${
                          isOwner ? "items-end" : "items-start"
                        }`}
                      >
                        {/* Quoted Reply Reference */}
                        {m.replyPreview && (
                          <div
                            className={`mb-1 text-[10px] px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-400 max-w-[75%] truncate ${
                              isOwner ? "mr-1 text-right" : "ml-1"
                            }`}
                          >
                            ↳ <span className="font-bold text-gray-300">[{m.replyPreview.senderType}]:</span>{" "}
                            {m.replyPreview.content}
                          </div>
                        )}

                        {/* Message Bubble */}
                        <div
                          className={`p-3 rounded-2xl text-xs sm:text-sm max-w-[85%] md:max-w-[75%] break-words leading-relaxed ${
                            isOwner
                              ? "bg-purple-600/90 text-white rounded-br-sm shadow-md"
                              : "bg-white/10 text-gray-100 rounded-bl-sm border border-white/5"
                          } ${m.isDeleted ? "italic opacity-60" : ""}`}
                        >
                          {isEditing ? (
                            <div className="space-y-2">
                              <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                className="w-full bg-black/60 border border-cyan-400 rounded-lg p-2 text-white text-xs outline-none"
                                rows={2}
                              />
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => setEditingMessageId(null)}
                                  className="text-[10px] px-2 py-1 rounded bg-white/10 text-gray-300 hover:text-white"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleSaveEdit(m.id)}
                                  className="text-[10px] px-2 py-1 rounded bg-cyan-500 font-bold text-black hover:bg-cyan-400"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <span>{m.content}</span>
                              {m.isEdited && !m.isDeleted && (
                                <span className="text-[10px] text-gray-400 font-mono ml-1.5 opacity-80">
                                  (edited)
                                </span>
                              )}
                            </div>
                          )}

                          {/* Media & Attachments Display */}
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
                                        <button
                                          type="button"
                                          onClick={() => setLightboxImage(streamUrl)}
                                          className="cursor-pointer block"
                                        >
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img
                                            src={streamUrl}
                                            alt={att.fileName}
                                            className="max-h-48 max-w-full rounded-lg object-contain hover:scale-102 transition-transform"
                                          />
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

                                    <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1">
                                      <span className="truncate max-w-[140px] font-mono">
                                        {att.fileName} ({Math.round(att.fileSize / 1024)} KB)
                                      </span>
                                      <a
                                        href={downloadUrl}
                                        download={att.fileName}
                                        className="text-cyan-400 hover:underline font-bold flex items-center gap-1"
                                      >
                                        ⬇ Download
                                      </a>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Reactions Row */}
                        {m.reactions && Object.keys(m.reactions).length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {Object.entries(m.reactions).map(([emoji, users]) => {
                              const reactedByAdmin = users.includes("owner");
                              return (
                                <button
                                  key={emoji}
                                  onClick={() => handleToggleReaction(m.id, emoji)}
                                  className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors cursor-pointer flex items-center gap-1 ${
                                    reactedByAdmin
                                      ? "bg-purple-900/60 border-purple-500 text-purple-200"
                                      : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                                  }`}
                                  title={`Reacted by: ${users.join(", ")}`}
                                >
                                  <span>{emoji}</span>
                                  <span className="font-mono">{users.length}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Message Metadata & Hover Actions */}
                        <div className="flex items-center gap-2 mt-1 px-1">
                          <span className="text-[9px] text-gray-500 font-mono">
                            {new Date(m.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {isOwner && (
                            <span className="text-[9px] text-gray-500">
                              {m.readAt ? "✓ Seen" : "• Sent"}
                            </span>
                          )}

                          {/* Hover Actions Menu */}
                          {!m.isDeleted && (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[11px] text-gray-400">
                              <button
                                onClick={() => setReplyingTo(m)}
                                className="hover:text-cyan-400 p-0.5"
                                title="Reply to message"
                              >
                                ↩️
                              </button>
                              <button
                                onClick={() =>
                                  setShowEmojiPickerForMsgId(
                                    showEmojiPickerForMsgId === m.id ? null : m.id,
                                  )
                                }
                                className="hover:text-yellow-400 p-0.5"
                                title="React"
                              >
                                😊
                              </button>
                              {isOwner && (
                                <button
                                  onClick={() => {
                                    setEditingMessageId(m.id);
                                    setEditText(m.content);
                                  }}
                                  className="hover:text-blue-400 p-0.5"
                                  title="Edit message"
                                >
                                  ✏️
                                </button>
                              )}
                              <button
                                onClick={() => setTargetDeleteMsgId(m.id)}
                                className="hover:text-red-400 p-0.5"
                                title="Delete message"
                              >
                                🗑️
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Emoji Picker Popup */}
                        {showEmojiPickerForMsgId === m.id && (
                          <div className="flex gap-1.5 p-1.5 bg-[#181824] border border-white/20 rounded-xl shadow-xl mt-1 z-10">
                            {EMOJI_OPTIONS.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => handleToggleReaction(m.id, emoji)}
                                className="text-sm hover:scale-125 transition-transform p-1 cursor-pointer"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer */}
              <div className="p-3 border-t border-white/10 bg-white/3 space-y-2">
                {/* Quoting Banner */}
                {replyingTo && (
                  <div className="flex items-center justify-between bg-white/5 border border-cyan-500/30 rounded-xl px-3 py-1.5 text-xs text-cyan-300">
                    <span className="truncate">
                      ↳ Quoting <strong>[{replyingTo.senderType}]</strong>: &quot;{replyingTo.content.slice(0, 60)}&quot;
                    </span>
                    <button
                      onClick={() => setReplyingTo(null)}
                      className="text-gray-400 hover:text-white ml-2 font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Pending Attachment Pills */}
                {pendingAttachments.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {pendingAttachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-1.5 bg-cyan-950/60 border border-cyan-800/60 text-cyan-200 text-[11px] px-2.5 py-1 rounded-lg"
                      >
                        <span className="truncate max-w-[150px]">{att.fileName}</span>
                        <button
                          onClick={() =>
                            setPendingAttachments((prev) => prev.filter((a) => a.id !== att.id))
                          }
                          className="hover:text-white font-bold cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {uploadError && <p className="text-red-400 text-xs">{uploadError}</p>}

                {/* Input & Action Buttons */}
                <form onSubmit={handleSendReply} className="flex gap-2 items-center">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAttachmentUpload}
                    accept="image/*,video/mp4,video/webm,audio/*"
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAttachment}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white px-3 py-2.5 rounded-xl text-xs transition-colors shrink-0 cursor-pointer"
                    title="Attach image, video, or audio"
                  >
                    {isUploadingAttachment ? "..." : "📎"}
                  </button>

                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    disabled={isSendingReply}
                    maxLength={2000}
                    placeholder={`Reply to ${activeConv.visitorName || "visitor"}...`}
                    className="flex-1 bg-black/40 border border-white/10 focus:border-cyan-400 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder:text-gray-500 outline-none"
                  />

                  <button
                    type="submit"
                    disabled={isSendingReply || (!replyText.trim() && pendingAttachments.length === 0)}
                    className="bg-linear-to-r from-purple-600 to-cyan-500 hover:opacity-90 text-white font-bold px-4 sm:px-5 py-2.5 rounded-xl text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
                  >
                    {isSendingReply ? "..." : "Reply"}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 text-sm p-8 text-center space-y-2">
              <span className="text-3xl">💬</span>
              <p>Select a conversation from the sidebar to view full message history and reply.</p>
            </div>
          )}
        </main>

        {/* PANEL 3: Right Details & Action Panel */}
        {showDetailsPanel && activeConv && (
          <aside className="w-full md:w-72 lg:w-80 bg-[#0a0a0c] border border-white/10 rounded-2xl flex flex-col p-4 space-y-4 shrink-0 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-sm text-white">Conversation Info</h3>
              <button
                onClick={() => setShowDetailsPanel(false)}
                className="text-gray-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Visitor Details */}
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-gray-500 font-mono block text-[10px] uppercase tracking-wider">
                  Visitor Name
                </span>
                <p className="font-bold text-white mt-0.5">{activeConv.visitorName || "Guest"}</p>
              </div>

              <div>
                <span className="text-gray-500 font-mono block text-[10px] uppercase tracking-wider">
                  Email Status
                </span>
                <p className="text-white mt-0.5">
                  {activeConv.visitorEmail || "None provided"}
                </p>
                {activeConv.visitorEmail && (
                  <span
                    className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-mono ${
                      activeConv.emailVerified
                        ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/60"
                        : "bg-amber-950/80 text-amber-300 border border-amber-800/60"
                    }`}
                  >
                    {activeConv.emailVerified ? "✓ Verified via OTP" : "⚠️ Unverified"}
                  </span>
                )}
              </div>

              <div>
                <span className="text-gray-500 font-mono block text-[10px] uppercase tracking-wider">
                  Notification Consent
                </span>
                <p className="text-white mt-0.5">
                  {activeConv.emailNotificationsEnabled ? "Opted In (Email Alerts ON)" : "Opted Out (No Alerts)"}
                </p>
              </div>

              <div>
                <span className="text-gray-500 font-mono block text-[10px] uppercase tracking-wider">
                  Started
                </span>
                <p className="text-gray-400 mt-0.5 font-mono">
                  {new Date(activeConv.createdAt).toLocaleString()}
                </p>
              </div>

              <div>
                <span className="text-gray-500 font-mono block text-[10px] uppercase tracking-wider">
                  Conversation ID
                </span>
                <p className="text-[10px] font-mono text-gray-500 break-all mt-0.5">{activeConv.id}</p>
              </div>
            </div>

            {/* Conversation Actions */}
            <div className="border-t border-white/10 pt-4 space-y-2">
              <span className="text-gray-500 font-mono block text-[10px] uppercase tracking-wider mb-2">
                Actions
              </span>

              <button
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                className="w-full bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800/50 text-cyan-300 text-xs py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <span>📄</span> {isExportingPdf ? "Generating PDF..." : "Download Full Chat (PDF)"}
              </button>

              <button
                onClick={() => handleToggleArchive(!activeConv.isArchived)}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs py-2 px-3 rounded-xl font-bold cursor-pointer transition-colors"
              >
                {activeConv.isArchived ? "Unarchive Conversation" : "Archive Conversation"}
              </button>

              <button
                onClick={() => setDeleteConvModalOpen(true)}
                className="w-full bg-red-950/30 hover:bg-red-900/40 border border-red-800/40 text-red-300 text-xs py-2 px-3 rounded-xl font-bold cursor-pointer transition-colors"
              >
                Delete Conversation...
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* MODAL: Delete Conversation Confirmation */}
      {deleteConvModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12121a] border border-red-500/30 rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h4 className="font-bold text-base text-white">Delete Entire Conversation?</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              Are you sure you want to delete this conversation with &quot;{activeConv?.visitorName || "Visitor"}&quot;? All associated messages and attachments will be deleted.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConvModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl text-gray-400 hover:text-white text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConversation}
                className="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-1.5 rounded-xl text-xs cursor-pointer shadow-lg shadow-red-600/20"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Delete Message Confirmation */}
      {targetDeleteMsgId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12121a] border border-red-500/30 rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h4 className="font-bold text-base text-white">Delete this Message?</h4>
            <p className="text-xs text-gray-400">
              The content will be deleted and marked as removed in the message history.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setTargetDeleteMsgId(null)}
                className="px-3.5 py-1.5 rounded-xl text-gray-400 hover:text-white text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteMessage(targetDeleteMsgId)}
                className="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-1.5 rounded-xl text-xs cursor-pointer"
              >
                Delete Message
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX: Image View Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxImage}
              alt="Attachment Preview"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
