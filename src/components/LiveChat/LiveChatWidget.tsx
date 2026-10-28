"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import LIVE_CHAT_ICON from "../../../public/assets/bot/Livechatbot.svg";

interface MessageItem {
  id: string;
  senderType: "visitor" | "owner";
  content: string;
  createdAt: string;
  status?: "sending" | "delivered" | "failed";
}

interface ProfileState {
  visitorName: string;
  visitorEmail: string;
  emailNotificationsEnabled: boolean;
}

export default function LiveChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [profile, setProfile] = useState<ProfileState>({
    visitorName: "Visitor",
    visitorEmail: "",
    emailNotificationsEnabled: false,
  });
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileState>({
    visitorName: "",
    visitorEmail: "",
    emailNotificationsEnabled: false,
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  // Online/Offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Initial session & messages load
  useEffect(() => {
    let active = true;
    const loadSessionAndMessages = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const chatToken = urlParams.get("chat_token");
        const url = chatToken
          ? `/api/live-chat/session?token=${encodeURIComponent(chatToken)}`
          : "/api/live-chat/session";

        const res = await fetch(url);
        if (active && res.ok) {
          const data = await res.json();
          setProfile({
            visitorName: data.visitorName || "Visitor",
            visitorEmail: data.visitorEmail || "",
            emailNotificationsEnabled: Boolean(data.emailNotificationsEnabled),
          });
          setProfileForm({
            visitorName: data.visitorName || "",
            visitorEmail: data.visitorEmail || "",
            emailNotificationsEnabled: Boolean(data.emailNotificationsEnabled),
          });
          setUnreadCount(data.unreadVisitorCount || 0);

          if (urlParams.get("live_chat") === "open" || chatToken) {
            setIsOpen(true);
          }
        }
      } catch (e) {
        console.warn("[Live Chat] Session init failed:", e);
      }

      try {
        const msgRes = await fetch("/api/live-chat/messages?mark_read=false");
        if (active && msgRes.ok) {
          const msgData = await msgRes.json();
          if (Array.isArray(msgData.messages)) {
            setMessages(msgData.messages);
          }
          if (typeof msgData.unreadVisitorCount === "number") {
            setUnreadCount(msgData.unreadVisitorCount);
          }
        }
      } catch {
        // Ignored
      }
    };

    loadSessionAndMessages();
    return () => {
      active = false;
    };
  }, []);

  // Polling when open
  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    scrollToBottom(false);

    const pull = async () => {
      try {
        const res = await fetch("/api/live-chat/messages?mark_read=true");
        if (active && res.ok) {
          const data = await res.json();
          if (Array.isArray(data.messages)) {
            setMessages(data.messages);
          }
          setUnreadCount(0);
        }
      } catch {
        // Ignored
      }
    };

    pull();
    const interval = setInterval(pull, 3500);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isOpen, scrollToBottom]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen) {
      scrollToBottom(true);
    }
  }, [messages.length, isOpen, scrollToBottom]);

  // Handle Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = inputValue.trim();
    if (!content || isSending) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: MessageItem = {
      id: tempId,
      senderType: "visitor",
      content,
      createdAt: new Date().toISOString(),
      status: "sending",
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setInputValue("");
    setIsSending(true);

    try {
      const res = await fetch("/api/live-chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...data.message, status: "delivered" } : m,
          ),
        );
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, status: "failed" } : m,
          ),
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, status: "failed" } : m,
        ),
      );
    } finally {
      setIsSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  // Save profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError("");
    setProfileSuccess(false);

    try {
      const res = await fetch("/api/live-chat/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileForm.visitorName,
          email: profileForm.visitorEmail,
          emailNotificationsEnabled: profileForm.emailNotificationsEnabled,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setProfile({
          visitorName: data.profile.visitorName || "Visitor",
          visitorEmail: data.profile.visitorEmail || "",
          emailNotificationsEnabled: Boolean(data.profile.emailNotificationsEnabled),
        });
        setProfileSuccess(true);
        setTimeout(() => {
          setShowProfileModal(false);
          setProfileSuccess(false);
        }, 1200);
      } else {
        setProfileError(data.error || "Failed to update profile.");
      }
    } catch {
      setProfileError("Network error. Please try again.");
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Launcher Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            setUnreadCount(0);
          }
        }}
        aria-label="Live Chat with Ganganathan"
        aria-expanded={isOpen}
        title="Live Chat with Ganganathan"
        className="fixed bottom-6 right-22 sm:bottom-8 sm:right-26 z-40 p-2 rounded-full bg-[#0a0a0c]/80 backdrop-blur-md border border-cyan-500/30 hover:border-cyan-400 hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-xl group"
      >
        <Image
          src={LIVE_CHAT_ICON}
          alt="Live Chat"
          width={56}
          height={56}
          className="object-contain drop-shadow-2xl w-12 h-12 sm:w-14 sm:h-14 transition-transform group-hover:scale-110"
        />
        <span className="sr-only">Toggle Live Chat with Ganganathan</span>

        {/* Live indicator green pulse */}
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-400"></span>
        </span>

        {/* Unread badge */}
        {unreadCount > 0 && !isOpen && (
          <span className="absolute -top-2 -left-2 bg-pink-500 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#050816] animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Live Chat Window */}
      {isOpen && (
        <div
          data-lenis-prevent
          data-lenis-prevent-touch
          role="dialog"
          aria-label="Direct Live Chat"
          className="fixed bottom-24 right-4 sm:right-24 w-[calc(100vw-2rem)] sm:w-92 md:w-96 h-[72vh] max-h-[580px] z-50 rounded-3xl border border-cyan-500/20 bg-[#07070a]/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <header className="p-3.5 sm:p-4 border-b border-white/10 bg-white/5 flex justify-between items-center select-none">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-linear-to-tr from-cyan-500 to-accent flex items-center justify-center text-white font-black text-xs shadow-md">
                  G
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#07070a] ${
                    isOnline ? "bg-emerald-400" : "bg-gray-400"
                  }`}
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                    Ganganathan
                  </h3>
                  <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded-full font-mono font-semibold">
                    DIRECT
                  </span>
                </div>
                <p className="text-[10px] text-gray-400">
                  {isOnline ? "Usually replies within hours" : "Offline"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowProfileModal(true)}
                title="Notification & Profile Settings"
                className="p-1.5 rounded-lg text-gray-400 hover:text-cyan-400 hover:bg-white/5 transition-colors text-xs font-mono"
              >
                ⚙️
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close Live Chat"
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors text-sm"
              >
                ✕
              </button>
            </div>
          </header>

          {/* Offline Banner */}
          {!isOnline && (
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-3 py-1.5 text-amber-300 text-[11px] text-center flex items-center justify-center gap-1">
              <span>⚠️</span> You are currently offline. Messages will sync when connection returns.
            </div>
          )}

          {/* Profile / Notification Consent Modal Overlay */}
          {showProfileModal && (
            <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-sm p-4 flex flex-col justify-center items-center">
              <div className="bg-[#101018] border border-cyan-500/30 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-white font-bold text-sm">Your Chat Profile</h4>
                  <button
                    onClick={() => setShowProfileModal(false)}
                    className="text-gray-400 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-3.5 text-xs">
                  <div>
                    <label className="text-gray-400 block mb-1 font-mono">Your Name</label>
                    <input
                      type="text"
                      maxLength={60}
                      value={profileForm.visitorName}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, visitorName: e.target.value })
                      }
                      placeholder="e.g. John Doe"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="text-gray-400 block mb-1 font-mono">
                      Your Email (Optional)
                    </label>
                    <input
                      type="email"
                      value={profileForm.visitorEmail}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, visitorEmail: e.target.value })
                      }
                      placeholder="you@example.com"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="flex items-start gap-2.5 pt-1">
                    <input
                      type="checkbox"
                      id="emailNotify"
                      checked={profileForm.emailNotificationsEnabled}
                      onChange={(e) =>
                        setProfileForm({
                          ...profileForm,
                          emailNotificationsEnabled: e.target.checked,
                        })
                      }
                      className="mt-0.5 rounded accent-cyan-500 cursor-pointer"
                    />
                    <label
                      htmlFor="emailNotify"
                      className="text-gray-300 leading-snug cursor-pointer select-none"
                    >
                      Email me when Ganganathan replies (requires email above). Notifications are throttled to avoid spam.
                    </label>
                  </div>

                  {profileError && (
                    <p className="text-red-400 text-[11px] pt-1">{profileError}</p>
                  )}
                  {profileSuccess && (
                    <p className="text-emerald-400 text-[11px] pt-1">Profile saved successfully!</p>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowProfileModal(false)}
                      className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={profileSaving}
                      className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-4 py-1.5 rounded-lg disabled:opacity-50"
                    >
                      {profileSaving ? "Saving..." : "Save Settings"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Messages Stream */}
          <section
            data-lenis-prevent
            className="custom-scrollbar flex-1 overflow-y-auto p-4 space-y-3.5"
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400 space-y-2">
                <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400 text-xl mb-1">
                  💬
                </div>
                <p className="text-xs font-semibold text-gray-300">
                  Private Conversation with Ganganathan
                </p>
                <p className="text-[11px] text-gray-500 leading-relaxed max-w-xs">
                  Leave a message about collaboration, projects, or questions. Ganganathan receives this directly in his inbox.
                </p>
                {!profile.visitorEmail && (
                  <button
                    onClick={() => setShowProfileModal(true)}
                    className="text-[11px] text-cyan-400 hover:underline pt-2"
                  >
                    + Add your email for reply notifications
                  </button>
                )}
              </div>
            ) : (
              messages.map((m) => {
                const isVisitor = m.senderType === "visitor";
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isVisitor ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`p-3 rounded-2xl text-xs sm:text-sm max-w-[85%] break-words leading-relaxed ${
                        isVisitor
                          ? "bg-cyan-600 text-white rounded-br-sm shadow-md"
                          : "bg-white/8 text-gray-100 border border-white/10 rounded-bl-sm"
                      }`}
                    >
                      {m.content}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 px-1">
                      <span className="text-[9px] text-gray-500 font-mono">
                        {new Date(m.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {isVisitor && m.status && (
                        <span className="text-[9px] text-gray-500">
                          {m.status === "sending" && "• Sending..."}
                          {m.status === "delivered" && "✓"}
                          {m.status === "failed" && "❌ Failed"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </section>

          {/* Footer Input */}
          <footer className="p-3 border-t border-white/10 bg-white/5">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                maxLength={2000}
                disabled={isSending}
                placeholder="Type a direct message to Ganganathan..."
                className="flex-1 bg-black/40 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-gray-500 outline-none border border-white/10 focus:border-cyan-400 transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isSending || !inputValue.trim()}
                className="bg-cyan-500 hover:bg-cyan-400 text-black px-4 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                {isSending ? "..." : "SEND"}
              </button>
            </form>
          </footer>
        </div>
      )}
    </>
  );
}
