"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import LIVE_CHAT_ICON from "../../../public/assets/bot/Livechatbot.svg";

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
  content?: string;
  snippet?: string;
}

interface MessageItem {
  id: string;
  conversationId?: string;
  senderType: "visitor" | "owner";
  content: string;
  createdAt: string;
  status?: "sending" | "delivered" | "failed";
  isEdited?: boolean;
  editedAt?: string | null;
  isDeleted?: boolean;
  deletedAt?: string | null;
  replyToId?: string | null;
  replyPreview?: ReplyPreviewItem | null;
  reactions?: Record<string, ("visitor" | "owner")[]>;
  attachments?: AttachmentItem[];
}

interface ProfileState {
  visitorName: string;
  visitorEmail: string;
  emailVerified: boolean;
  emailNotificationsEnabled: boolean;
}

const EMOJI_OPTIONS = ["👍", "❤️", "🔥", "🎉", "🚀", "👀"];
const MAX_IMAGE_AUDIO_SIZE = 15 * 1024 * 1024; // 15MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

export default function LiveChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  // Profile & OTP state
  const [profile, setProfile] = useState<ProfileState>({
    visitorName: "Visitor",
    visitorEmail: "",
    emailVerified: false,
    emailNotificationsEnabled: false,
  });

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileState>({
    visitorName: "",
    visitorEmail: "",
    emailVerified: false,
    emailNotificationsEnabled: false,
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState(false);

  // OTP Verification State
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpMessage, setOtpMessage] = useState("");
  const [otpError, setOtpError] = useState("");

  // Advanced chat state
  const [replyingTo, setReplyingTo] = useState<MessageItem | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [showEmojiPickerForMsgId, setShowEmojiPickerForMsgId] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentItem[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [deletingMsgId, setDeletingMsgId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cooldown countdown timer
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

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
        const res = await fetch("/api/live-chat/session");
        if (active && res.ok) {
          const data = await res.json();
          const loadedProfile: ProfileState = {
            visitorName: data.visitorName || "Visitor",
            visitorEmail: data.visitorEmail || "",
            emailVerified: Boolean(data.emailVerified),
            emailNotificationsEnabled: Boolean(data.emailNotificationsEnabled),
          };
          setProfile(loadedProfile);
          setProfileForm({
            visitorName: data.visitorName || "",
            visitorEmail: data.visitorEmail || "",
            emailVerified: Boolean(data.emailVerified),
            emailNotificationsEnabled: Boolean(data.emailNotificationsEnabled),
          });
          setUnreadCount(data.unreadVisitorCount || 0);

          if (urlParams.get("live_chat") === "open") {
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

  // Polling when chat is open
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
            setMessages((prev) => {
              // Preserve optimistic sending messages
              const sending = prev.filter((m) => m.status === "sending");
              const backendIds = new Set(data.messages.map((m: MessageItem) => m.id));
              const remainingSending = sending.filter((m) => !backendIds.has(m.id));
              return [...data.messages, ...remainingSending];
            });
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
    const text = inputValue.trim();
    const hasAttachments = pendingAttachments.length > 0;
    if ((!text && !hasAttachments) || isSending) return;

    const tempId = `temp_${Date.now()}`;
    const optimisticMessage: MessageItem = {
      id: tempId,
      senderType: "visitor",
      content: text || (hasAttachments ? `[Attached ${pendingAttachments[0].fileName}]` : ""),
      createdAt: new Date().toISOString(),
      status: "sending",
      replyPreview: replyingTo
        ? {
            id: replyingTo.id,
            senderType: replyingTo.senderType,
            snippet: replyingTo.content.slice(0, 80),
          }
        : null,
      attachments: hasAttachments ? [...pendingAttachments] : undefined,
    };

    const payload = {
      content: text,
      replyToId: replyingTo ? replyingTo.id : undefined,
      attachmentIds: pendingAttachments.map((a) => a.id),
      clientMessageId: tempId,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setInputValue("");
    setReplyingTo(null);
    setPendingAttachments([]);
    setIsSending(true);

    try {
      const res = await fetch("/api/live-chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...data.message,
                  status: "delivered",
                }
              : m,
          ),
        );
      } else {
        const errData = await res.json().catch(() => ({}));
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m)),
        );
        console.warn("[Live Chat Send Error]:", errData.error);
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m)),
      );
    } finally {
      setIsSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  // Handle file attachment upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError("");
    const isVideo = file.type.startsWith("video/");
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_AUDIO_SIZE;

    if (file.size > maxSize) {
      setUploadError(`File exceeds ${isVideo ? "50MB" : "15MB"} limit.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/live-chat/attachments", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.attachment) {
        setPendingAttachments((prev) => [...prev, data.attachment]);
      } else {
        setUploadError(data.error || "Failed to upload attachment.");
      }
    } catch {
      setUploadError("Upload network error. Please try again.");
    } finally {
      setIsUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Handle toggling reaction
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    setShowEmojiPickerForMsgId(null);

    // Optimistic UI update
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const currentReactions = { ...(m.reactions || {}) };
        const users = currentReactions[emoji] ? [...currentReactions[emoji]] : [];
        const hasVisitor = users.includes("visitor");

        if (hasVisitor) {
          const filtered = users.filter((u) => u !== "visitor");
          if (filtered.length > 0) {
            currentReactions[emoji] = filtered;
          } else {
            delete currentReactions[emoji];
          }
        } else {
          currentReactions[emoji] = [...users, "visitor"];
        }

        return { ...m, reactions: currentReactions };
      }),
    );

    try {
      const res = await fetch("/api/live-chat/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, emoji }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.reactions) {
          setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? { ...m, reactions: data.reactions } : m)),
          );
        }
      }
    } catch (e) {
      console.warn("[Reaction Error]:", e);
    }
  };

  // Handle saving an edited message
  const handleSaveEdit = async (messageId: string) => {
    const text = editText.trim();
    if (!text) return;

    try {
      const res = await fetch("/api/live-chat/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, content: text }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, content: data.message?.content || text, isEdited: true }
              : m,
          ),
        );
        setEditingMessageId(null);
        setEditText("");
      }
    } catch (e) {
      console.warn("[Edit Error]:", e);
    }
  };

  // Handle deleting a message
  const handleDeleteMessage = async (messageId: string) => {
    try {
      const res = await fetch("/api/live-chat/messages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });

      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  isDeleted: true,
                  content: "[This message was deleted]",
                  attachments: undefined,
                }
              : m,
          ),
        );
        setDeletingMsgId(null);
      }
    } catch (e) {
      console.warn("[Delete Error]:", e);
    }
  };

  // Request Email OTP
  const handleRequestOtp = async () => {
    const emailToVerify = profileForm.visitorEmail.trim().toLowerCase();
    if (!emailToVerify || !emailToVerify.includes("@")) {
      setOtpError("Please enter a valid email address first.");
      return;
    }

    setOtpSending(true);
    setOtpError("");
    setOtpMessage("");

    try {
      const res = await fetch("/api/live-chat/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToVerify }),
      });

      const data = await res.json();
      if (res.ok) {
        setOtpSent(true);
        setOtpCooldown(data.cooldownSeconds || 60);
        setOtpMessage("Verification code sent! Check your email inbox.");
      } else {
        setOtpError(data.error || "Failed to send verification code.");
        if (data.retryAfter) {
          setOtpCooldown(data.retryAfter);
        }
      }
    } catch {
      setOtpError("Network error sending code. Please try again.");
    } finally {
      setOtpSending(false);
    }
  };

  // Verify Email OTP
  const handleVerifyOtp = async () => {
    const code = otpCode.trim();
    const email = profileForm.visitorEmail.trim().toLowerCase();
    if (!/^\d{6}$/.test(code)) {
      setOtpError("Please enter a 6-digit numeric verification code.");
      return;
    }

    setOtpVerifying(true);
    setOtpError("");
    setOtpMessage("");

    try {
      const res = await fetch("/api/live-chat/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code }),
      });

      const data = await res.json();
      if (res.ok) {
        setProfile((prev) => ({
          ...prev,
          visitorEmail: email,
          emailVerified: true,
          emailNotificationsEnabled: true,
        }));
        setProfileForm((prev) => ({
          ...prev,
          visitorEmail: email,
          emailVerified: true,
          emailNotificationsEnabled: true,
        }));
        setOtpMessage("Email verified successfully! Reply alerts are now active.");
        setOtpCode("");
        setOtpSent(false);
      } else {
        setOtpError(data.error || "Verification failed.");
      }
    } catch {
      setOtpError("Network error verifying code. Please try again.");
    } finally {
      setOtpVerifying(false);
    }
  };

  // Save profile settings
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
          emailVerified: Boolean(data.profile.emailVerified),
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

  const isCurrentEmailVerified =
    profile.emailVerified &&
    profile.visitorEmail.toLowerCase().trim() === profileForm.visitorEmail.toLowerCase().trim() &&
    profileForm.visitorEmail.trim() !== "";

  return (
    <>
      {/* Lightbox Modal for Attachment Images */}
      {lightboxImage && (
        <div
          role="dialog"
          aria-label="Image preview"
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
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
            <button
              onClick={() => setLightboxImage(null)}
              className="mt-3 px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-mono transition-colors cursor-pointer"
            >
              ✕ Close Preview (Esc)
            </button>
          </div>
        </div>
      )}

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

        {/* Live indicator cyan pulse */}
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
          className="fixed bottom-24 right-4 sm:right-24 w-[calc(100vw-2rem)] sm:w-96 md:w-[420px] h-[75vh] max-h-[620px] z-50 rounded-3xl border border-cyan-500/20 bg-[#07070a]/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden"
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
                  {profile.emailVerified ? (
                    <span className="text-emerald-400 font-mono">✉️ Email Alerts Active</span>
                  ) : profile.visitorEmail ? (
                    <span className="text-amber-400 font-mono">⚠️ Email Unverified</span>
                  ) : (
                    "Anonymous Guest Chat"
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowProfileModal(true)}
                title="Notification & Profile Settings"
                className="p-1.5 rounded-lg text-gray-400 hover:text-cyan-400 hover:bg-white/5 transition-colors text-xs font-mono cursor-pointer"
              >
                ⚙️
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close Live Chat"
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>
          </header>

          {/* Anonymous Guest Information Banner */}
          {!profile.visitorEmail && (
            <div className="bg-cyan-950/40 border-b border-cyan-800/30 px-3 py-1.5 text-cyan-300 text-[10px] flex items-center justify-between">
              <span>👤 Guest Chat active (no account needed).</span>
              <button
                onClick={() => setShowProfileModal(true)}
                className="underline hover:text-white cursor-pointer font-bold ml-1"
              >
                Get email alerts
              </button>
            </div>
          )}

          {/* Offline Banner */}
          {!isOnline && (
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-3 py-1.5 text-amber-300 text-[11px] text-center flex items-center justify-center gap-1">
              <span>⚠️</span> You are currently offline. Messages will sync when connection returns.
            </div>
          )}

          {/* Profile / OTP Verification Modal Overlay */}
          {showProfileModal && (
            <div className="absolute inset-0 z-30 bg-black/85 backdrop-blur-sm p-4 flex flex-col justify-center items-center overflow-y-auto">
              <div className="bg-[#101018] border border-cyan-500/30 rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4">
                <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
                  <div>
                    <h4 className="text-white font-bold text-sm">Chat Settings & Alerts</h4>
                    <p className="text-[10px] text-gray-400">Guest chat is private to this browser session.</p>
                  </div>
                  <button
                    onClick={() => setShowProfileModal(false)}
                    className="text-gray-400 hover:text-white text-xs cursor-pointer p-1"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
                  <div>
                    <label className="text-gray-400 block mb-1 font-mono">Your Name (Optional)</label>
                    <input
                      type="text"
                      maxLength={60}
                      value={profileForm.visitorName}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, visitorName: e.target.value })
                      }
                      placeholder="e.g. Recruiter / Colleague"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-gray-400 font-mono">Your Email (Optional)</label>
                      {isCurrentEmailVerified && (
                        <span className="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded-full font-mono">
                          ✓ Verified
                        </span>
                      )}
                    </div>
                    <input
                      type="email"
                      value={profileForm.visitorEmail}
                      onChange={(e) => {
                        setProfileForm({ ...profileForm, visitorEmail: e.target.value });
                        setOtpSent(false);
                        setOtpMessage("");
                        setOtpError("");
                      }}
                      placeholder="you@example.com"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      Leave empty to continue chatting anonymously.
                    </p>
                  </div>

                  {/* Secure Email OTP Verification Section */}
                  {profileForm.visitorEmail.trim() !== "" && !isCurrentEmailVerified && (
                    <div className="bg-white/5 border border-cyan-500/20 rounded-xl p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-cyan-300">
                          Verify Email for Reply Alerts
                        </span>
                        <button
                          type="button"
                          disabled={otpSending || otpCooldown > 0}
                          onClick={handleRequestOtp}
                          className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 px-2.5 py-1 rounded-lg text-[10px] font-mono transition-colors disabled:opacity-40 cursor-pointer"
                        >
                          {otpSending
                            ? "Sending..."
                            : otpCooldown > 0
                            ? `Resend in ${otpCooldown}s`
                            : "Send OTP Code"}
                        </button>
                      </div>

                      {otpSent && (
                        <div className="flex gap-2 items-center pt-1">
                          <input
                            type="text"
                            maxLength={6}
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                            placeholder="6-digit code"
                            className="w-32 bg-black/60 border border-cyan-500/40 rounded-lg px-2.5 py-1 text-center font-mono text-cyan-300 tracking-wider text-xs outline-none focus:border-cyan-400"
                          />
                          <button
                            type="button"
                            disabled={otpVerifying || otpCode.length !== 6}
                            onClick={handleVerifyOtp}
                            className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-3 py-1 rounded-lg text-xs transition-colors disabled:opacity-40 cursor-pointer"
                          >
                            {otpVerifying ? "..." : "Verify Code"}
                          </button>
                        </div>
                      )}

                      {otpMessage && (
                        <p className="text-emerald-400 text-[10px]">{otpMessage}</p>
                      )}
                      {otpError && (
                        <p className="text-red-400 text-[10px]">{otpError}</p>
                      )}
                    </div>
                  )}

                  {/* Notification Consent Checkbox */}
                  <div className="flex items-start gap-2 pt-1">
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
                      className="text-gray-300 text-[11px] leading-snug cursor-pointer select-none"
                    >
                      Email me when Ganganathan replies (requires verified email above).
                    </label>
                  </div>

                  {profileError && (
                    <p className="text-red-400 text-[11px] pt-1">{profileError}</p>
                  )}
                  {profileSuccess && (
                    <p className="text-emerald-400 text-[11px] pt-1">Settings updated!</p>
                  )}

                  <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setShowProfileModal(false)}
                      className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={profileSaving}
                      className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-4 py-1.5 rounded-lg disabled:opacity-50 cursor-pointer"
                    >
                      {profileSaving ? "Saving..." : "Save Settings"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Delete Message Confirmation Dialog */}
          {deletingMsgId && (
            <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-[#12121b] border border-red-500/30 rounded-2xl p-4 w-full max-w-xs text-center space-y-3 shadow-2xl">
                <h4 className="text-sm font-bold text-white">Delete Message?</h4>
                <p className="text-xs text-gray-400">
                  This will remove the message content from the conversation.
                </p>
                <div className="flex justify-center gap-2 pt-1">
                  <button
                    onClick={() => setDeletingMsgId(null)}
                    className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteMessage(deletingMsgId)}
                    className="bg-red-500 hover:bg-red-400 text-white font-bold px-4 py-1.5 rounded-lg text-xs cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Messages Stream */}
          <section
            data-lenis-prevent
            className="custom-scrollbar flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3.5"
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
                  Leave a direct message about projects, hiring, or questions. Ganganathan receives your message directly in his inbox.
                </p>
                {!profile.visitorEmail && (
                  <button
                    onClick={() => setShowProfileModal(true)}
                    className="text-[11px] text-cyan-400 hover:underline pt-2 cursor-pointer"
                  >
                    + Add & verify email for reply alerts
                  </button>
                )}
              </div>
            ) : (
              messages.map((m) => {
                const isVisitor = m.senderType === "visitor";
                const isEditing = editingMessageId === m.id;

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col group relative ${
                      isVisitor ? "items-end" : "items-start"
                    }`}
                  >
                    {/* Quoted Reply Reference */}
                    {m.replyPreview && (
                      <div
                        className={`mb-1 text-[10px] px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-400 max-w-[80%] truncate ${
                          isVisitor ? "mr-1 text-right" : "ml-1"
                        }`}
                      >
                        ↳ <span className="font-bold text-gray-300">[{m.replyPreview.senderType === "owner" ? "Ganganathan" : "You"}]:</span>{" "}
                        {m.replyPreview.snippet || m.replyPreview.content}
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={`p-3 rounded-2xl text-xs sm:text-sm max-w-[85%] break-words leading-relaxed ${
                        isVisitor
                          ? "bg-cyan-600 text-white rounded-br-sm shadow-md"
                          : "bg-white/8 text-gray-100 border border-white/10 rounded-bl-sm"
                      } ${m.isDeleted ? "italic opacity-60 bg-white/5 text-gray-400 border border-white/10" : ""}`}
                    >
                      {isEditing ? (
                        <div className="space-y-2 min-w-[200px]">
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="w-full bg-black/60 border border-cyan-300 rounded-lg p-2 text-white text-xs outline-none"
                            rows={2}
                          />
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => setEditingMessageId(null)}
                              className="text-[10px] px-2 py-1 rounded bg-white/10 text-gray-300 hover:text-white cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveEdit(m.id)}
                              className="text-[10px] px-2.5 py-1 rounded bg-white text-black font-bold hover:bg-gray-200 cursor-pointer"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span>{m.content}</span>
                          {m.isEdited && !m.isDeleted && (
                            <span className="text-[10px] text-cyan-200/80 font-mono ml-1.5 opacity-80">
                              (edited)
                            </span>
                          )}
                        </div>
                      )}

                      {/* Media & Attachments Display */}
                      {m.attachments && m.attachments.length > 0 && !m.isDeleted && (
                        <div className="mt-2.5 pt-2 border-t border-white/15 space-y-2">
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
                                  <div className="relative overflow-hidden rounded-lg">
                                    <button
                                      type="button"
                                      onClick={() => setLightboxImage(streamUrl)}
                                      className="cursor-pointer block"
                                      title="Click to view image full size"
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={streamUrl}
                                        alt={att.fileName}
                                        className="max-h-40 max-w-full rounded-lg object-contain hover:scale-102 transition-transform"
                                      />
                                    </button>
                                  </div>
                                )}

                                {isVid && (
                                  <video
                                    controls
                                    className="max-h-40 max-w-full rounded-lg bg-black"
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

                                <div className="flex items-center justify-between text-[10px] text-gray-300 pt-0.5">
                                  <span className="truncate max-w-[140px] font-mono opacity-80">
                                    {att.fileName} ({Math.round(att.fileSize / 1024)} KB)
                                  </span>
                                  <a
                                    href={downloadUrl}
                                    download={att.fileName}
                                    className="text-cyan-300 hover:underline font-bold flex items-center gap-1 shrink-0 ml-1"
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
                          const reactedByVisitor = users.includes("visitor");
                          return (
                            <button
                              key={emoji}
                              onClick={() => handleToggleReaction(m.id, emoji)}
                              className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors cursor-pointer flex items-center gap-1 ${
                                reactedByVisitor
                                  ? "bg-cyan-900/60 border-cyan-400 text-cyan-200"
                                  : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                              }`}
                              title={`Reacted: ${users.length}`}
                            >
                              <span>{emoji}</span>
                              <span className="font-mono">{users.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Message Metadata & Action Buttons */}
                    <div className="flex items-center gap-2 mt-1 px-1">
                      <span className="text-[9px] text-gray-500 font-mono">
                        {new Date(m.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {isVisitor && m.status && (
                        <span className="text-[9px] text-gray-400">
                          {m.status === "sending" && "• Sending..."}
                          {m.status === "delivered" && "✓"}
                          {m.status === "failed" && "❌ Failed"}
                        </span>
                      )}

                      {/* Action Menu (Visible on hover or tap) */}
                      {!m.isDeleted && (
                        <div className="opacity-75 sm:opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[11px] text-gray-400">
                          <button
                            type="button"
                            onClick={() => setReplyingTo(m)}
                            className="hover:text-cyan-400 p-0.5 cursor-pointer"
                            title="Reply to message"
                          >
                            ↩️
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setShowEmojiPickerForMsgId(
                                showEmojiPickerForMsgId === m.id ? null : m.id,
                              )
                            }
                            className="hover:text-yellow-400 p-0.5 cursor-pointer"
                            title="React with emoji"
                          >
                            😊
                          </button>
                          {isVisitor && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMessageId(m.id);
                                  setEditText(m.content);
                                }}
                                className="hover:text-blue-400 p-0.5 cursor-pointer"
                                title="Edit message"
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingMsgId(m.id)}
                                className="hover:text-red-400 p-0.5 cursor-pointer"
                                title="Delete message"
                              >
                                🗑️
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Emoji Reaction Selector Popup */}
                    {showEmojiPickerForMsgId === m.id && (
                      <div className="flex gap-1.5 p-1.5 bg-[#181824] border border-cyan-500/30 rounded-xl shadow-xl mt-1 z-20">
                        {EMOJI_OPTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
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
          </section>

          {/* Footer Input Area */}
          <footer className="p-3 border-t border-white/10 bg-white/5 space-y-2">
            {/* Replying Banner */}
            {replyingTo && (
              <div className="flex items-center justify-between bg-white/5 border border-cyan-500/30 rounded-xl px-3 py-1 text-xs text-cyan-300">
                <span className="truncate">
                  ↳ Replying to <strong>[{replyingTo.senderType === "owner" ? "Ganganathan" : "You"}]</strong>: &quot;{replyingTo.content.slice(0, 50)}&quot;
                </span>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="text-gray-400 hover:text-white ml-2 font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Pending Attachments List */}
            {pendingAttachments.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {pendingAttachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-1.5 bg-cyan-950/60 border border-cyan-800/60 text-cyan-200 text-[11px] px-2.5 py-1 rounded-lg"
                  >
                    <span className="truncate max-w-[140px] font-mono">{att.fileName}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingAttachments((prev) => prev.filter((a) => a.id !== att.id))
                      }
                      className="hover:text-white font-bold cursor-pointer text-xs"
                      title="Remove attachment"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Status / Error */}
            {isUploadingAttachment && (
              <p className="text-[10px] text-cyan-300 font-mono animate-pulse">
                Uploading attachment...
              </p>
            )}
            {uploadError && (
              <p className="text-[10px] text-red-400 font-mono">{uploadError}</p>
            )}

            {/* Composer Row */}
            <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm,audio/mpeg,audio/wav,audio/ogg"
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* Attachment Button */}
              <button
                type="button"
                disabled={isUploadingAttachment || isSending}
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 rounded-xl bg-black/40 border border-white/10 hover:border-cyan-400 text-gray-400 hover:text-cyan-300 transition-colors disabled:opacity-40 cursor-pointer shrink-0"
                title="Attach image, video, or audio (up to 50MB)"
              >
                📎
              </button>

              <input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                maxLength={2000}
                disabled={isSending}
                placeholder={
                  pendingAttachments.length > 0
                    ? "Add an optional message..."
                    : "Type a direct message to Ganganathan..."
                }
                className="flex-1 bg-black/40 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-gray-500 outline-none border border-white/10 focus:border-cyan-400 transition-colors disabled:opacity-50"
              />

              <button
                type="submit"
                disabled={isSending || (!inputValue.trim() && pendingAttachments.length === 0)}
                className="bg-cyan-500 hover:bg-cyan-400 text-black px-4 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
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
