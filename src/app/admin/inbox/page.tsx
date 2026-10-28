"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

interface ConversationItem {
  id: string;
  visitorName: string;
  visitorEmail?: string | null;
  emailNotificationsEnabled: boolean;
  createdAt: string;
  lastMessageAt: string;
  unreadOwnerCount: number;
  latestMessage?: string;
}

interface MessageItem {
  id: string;
  senderType: "visitor" | "owner";
  content: string;
  createdAt: string;
  readAt?: string | null;
}

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
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check auth on load
  useEffect(() => {
    let active = true;
    const verifyAuth = async () => {
      try {
        const res = await fetch("/api/admin/auth/check");
        const data = await res.json();
        if (active) {
          setIsAuthenticated(Boolean(data.authenticated));
        }
      } catch {
        if (active) {
          setIsAuthenticated(false);
        }
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
      const res = await fetch("/api/admin/live-chat/conversations");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.conversations)) {
          setConversations(data.conversations);
          setSelectedConvId((prev) => prev || (data.conversations.length > 0 ? data.conversations[0].id : null));
        }
      } else if (res.status === 401) {
        setIsAuthenticated(false);
      }
    } catch (e) {
      console.warn("[Admin Inbox] Fetch conversations error:", e);
    }
  }, []);

  // Poll conversations & active messages when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    let active = true;
    const runPoll = async () => {
      try {
        const res = await fetch("/api/admin/live-chat/conversations");
        if (active && res.ok) {
          const data = await res.json();
          if (Array.isArray(data.conversations)) {
            setConversations(data.conversations);
            setSelectedConvId((prev) => prev || (data.conversations.length > 0 ? data.conversations[0].id : null));
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
  }, [isAuthenticated, selectedConvId]);

  // When selected conversation changes
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

  // Auto scroll messages
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
    if (!text || !selectedConvId || isSendingReply) return;

    setIsSendingReply(true);
    try {
      const res = await fetch("/api/admin/live-chat/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selectedConvId,
          content: text,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveMessages((prev) => [...prev, data.message]);
        setReplyText("");
        fetchConversations();
      }
    } catch (err) {
      console.error("[Admin Reply Exception]:", err);
    } finally {
      setIsSendingReply(false);
    }
  };

  // Filtered conversations
  const filteredConversations = conversations.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.visitorName.toLowerCase().includes(q) ||
      (c.visitorEmail && c.visitorEmail.toLowerCase().includes(q)) ||
      (c.latestMessage && c.latestMessage.toLowerCase().includes(q))
    );
  });

  const activeConv = conversations.find((c) => c.id === selectedConvId);

  // Authentication Loading State
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#050816] flex items-center justify-center text-white font-mono">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-accent animate-ping" />
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
          <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-cyan-400 via-accent to-purple-500" />

          <div className="text-center mb-8">
            <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 bg-cyan-950/40 px-3 py-1 rounded-full border border-cyan-800/40">
              PORTFOLIO ADMIN
            </span>
            <h1 className="text-2xl font-black text-white mt-4">Owner Live Inbox</h1>
            <p className="text-gray-400 text-xs mt-2">
              Enter your portfolio admin credentials to manage live visitor messages.
            </p>
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
                className="w-full bg-white/5 border border-white/10 focus:border-accent rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors"
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
              className="w-full bg-linear-to-r from-accent to-cyan-500 hover:opacity-90 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-lg shadow-accent/20 cursor-pointer"
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
    <div className="min-h-screen bg-[#050816] text-white flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b border-white/10 bg-[#07070c] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-white text-xs font-mono">
            ← Home
          </Link>
          <span className="text-gray-600">/</span>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h1 className="text-sm font-bold tracking-wide">Ganganathan Admin Live Inbox</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-400 hidden sm:inline font-mono">
            {conversations.length} total conversation{conversations.length === 1 ? "" : "s"}
          </span>
          <button
            onClick={handleLogout}
            className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg text-gray-300 hover:text-white transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Inbox Split Layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden max-w-7xl w-full mx-auto p-4 md:p-6 gap-6">
        {/* Left Panel: Conversation Directory */}
        <aside className="w-full md:w-80 lg:w-96 bg-[#0a0a0c] border border-white/10 rounded-2xl flex flex-col overflow-hidden">
          {/* Search Header */}
          <div className="p-3 border-b border-white/10">
            <input
              type="text"
              placeholder="Search visitors or messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-gray-500 outline-none focus:border-cyan-400"
            />
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-white/5">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-xs">
                No conversations found.
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.id === selectedConvId;
                return (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConvId(conv.id)}
                    className={`w-full text-left p-4 transition-colors flex items-start justify-between gap-3 ${
                      isSelected
                        ? "bg-white/10 border-l-4 border-cyan-400"
                        : "hover:bg-white/5"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white truncate">
                          {conv.visitorName || "Anonymous Visitor"}
                        </span>
                        {conv.unreadOwnerCount > 0 && (
                          <span className="bg-pink-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {conv.unreadOwnerCount} new
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

        {/* Right Panel: Active Conversation View */}
        <main className="flex-1 bg-[#0a0a0c] border border-white/10 rounded-2xl flex flex-col overflow-hidden min-h-[480px]">
          {activeConv ? (
            <>
              {/* Conversation Top Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white">
                      {activeConv.visitorName || "Visitor"}
                    </h2>
                    {activeConv.emailNotificationsEnabled ? (
                      <span className="text-[10px] bg-emerald-950/60 text-emerald-300 border border-emerald-800/50 px-2 py-0.5 rounded-full font-mono">
                        ✉️ Email Alerts ON
                      </span>
                    ) : (
                      <span className="text-[10px] bg-gray-900 text-gray-400 border border-gray-800 px-2 py-0.5 rounded-full font-mono">
                        No Email Alerts
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">
                    {activeConv.visitorEmail || "No email provided"}
                  </p>
                </div>
              </div>

              {/* Messages Scroll Area */}
              <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-3">
                {isLoadingMessages ? (
                  <div className="h-full flex items-center justify-center text-gray-500 text-xs font-mono">
                    Loading conversation messages...
                  </div>
                ) : activeMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-500 text-xs">
                    No messages in this conversation.
                  </div>
                ) : (
                  activeMessages.map((m) => {
                    const isOwner = m.senderType === "owner";
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isOwner ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`p-3 rounded-2xl text-xs sm:text-sm max-w-[80%] break-words leading-relaxed ${
                            isOwner
                              ? "bg-accent text-white rounded-br-sm"
                              : "bg-white/10 text-gray-100 rounded-bl-sm"
                          }`}
                        >
                          {m.content}
                        </div>
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
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Form */}
              <div className="p-3 border-t border-white/10 bg-white/3">
                <form onSubmit={handleSendReply} className="flex gap-2">
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    disabled={isSendingReply}
                    maxLength={2000}
                    placeholder={`Reply to ${activeConv.visitorName || "visitor"}...`}
                    className="flex-1 bg-black/40 border border-white/10 focus:border-cyan-400 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-500 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isSendingReply || !replyText.trim()}
                    className="bg-accent hover:bg-accent/80 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isSendingReply ? "Sending..." : "Reply"}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              Select a conversation from the left to view messages.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
