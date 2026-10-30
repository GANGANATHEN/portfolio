"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import {
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
  X,
  Settings,
  Download,
  AlertCircle,
  RefreshCw,
  FileText,
  ShieldCheck,
  Maximize2,
  Minimize2,
  Mic,
  Square,
  FileArchive,
  FileSpreadsheet,
  Clock,
  Info,
} from "lucide-react";
import LIVE_CHAT_ICON from "../../../public/assets/bot/Livechatbot.svg";
import TelegramEmojiPicker from "./TelegramEmojiPicker";
import AttachmentViewerModal, { type ViewerAttachment } from "./AttachmentViewerModal";
import { useVoiceRecording } from "./useVoiceRecording";

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
  readAt?: string | null;
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

const QUICK_REACTIONS = ["👍", "❤️", "🔥", "🎉", "😂", "😮", "😢", "🙏"];
const MAX_DOCUMENT_IMAGE_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

interface LiveChatWidgetProps {
  isOpen?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
}

export default function LiveChatWidget({
  isOpen: controlledIsOpen,
  onToggle: controlledOnToggle,
  onClose: controlledOnClose,
}: LiveChatWidgetProps = {}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = typeof controlledIsOpen === "boolean" ? controlledIsOpen : internalIsOpen;

  const handleToggle = useCallback(() => {
    if (controlledOnToggle) {
      controlledOnToggle();
    } else {
      setInternalIsOpen((prev) => !prev);
    }
  }, [controlledOnToggle]);

  const handleClose = useCallback(() => {
    if (controlledOnClose) {
      controlledOnClose();
    } else {
      setInternalIsOpen(false);
    }
  }, [controlledOnClose]);

  const handleOpen = useCallback(() => {
    if (controlledIsOpen !== undefined) {
      if (!controlledIsOpen && controlledOnToggle) {
        controlledOnToggle();
      }
    } else {
      setInternalIsOpen(true);
    }
  }, [controlledIsOpen, controlledOnToggle]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Connection & Error Backoff State
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "reconnecting" | "error">("connected");
  const [connectionErrorMsg, setConnectionErrorMsg] = useState("");
  const [sessionSupersededMsg, setSessionSupersededMsg] = useState("");
  const backoffDelayRef = useRef(3500);
  const isPollingInFlightRef = useRef(false);

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
  const [dismissedRetentionNotice, setDismissedRetentionNotice] = useState(false);

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
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);
  const [showFullPickerForMsgId, setShowFullPickerForMsgId] = useState<string | null>(null);
  const [showComposerEmojiPicker, setShowComposerEmojiPicker] = useState(false);

  const [pendingAttachments, setPendingAttachments] = useState<AttachmentItem[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [activeViewerAttachment, setActiveViewerAttachment] = useState<ViewerAttachment | null>(null);
  const [activeViewerList, setActiveViewerList] = useState<ViewerAttachment[]>([]);
  const [deletingMsgId, setDeletingMsgId] = useState<string | null>(null);
  const [copiedToast, setCopiedToast] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  // Setup Voice Recording hook
  const {
    isRecording,
    recordingDuration,
    errorMessage: voiceError,
    startRecording,
    stopRecording,
    cancelRecording,
    clearError: clearVoiceError,
  } = useVoiceRecording({
    onTranscript: (transcript) => {
      setInputValue(transcript);
    },
  });

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

  // Outside-click-to-close behavior in floating mode
  useEffect(() => {
    if (!isOpen || isFullscreen) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (chatRef.current?.contains(target) || launcherRef.current?.contains(target)) {
        return;
      }

      // Do not close if clicking inside modals or popovers
      if (target.closest('[role="dialog"]') && !chatRef.current?.contains(target)) {
        return;
      }

      handleClose();
    };

    document.addEventListener("pointerdown", handleOutsideClick);
    return () => document.removeEventListener("pointerdown", handleOutsideClick);
  }, [isOpen, isFullscreen, handleClose]);

  // Handle Escape key: close viewer -> close modal -> close pickers -> cancel voice -> exit fullscreen -> close chat
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activeViewerAttachment) {
          e.stopPropagation();
          setActiveViewerAttachment(null);
          return;
        }
        if (showProfileModal) {
          e.stopPropagation();
          setShowProfileModal(false);
          return;
        }
        if (activeReactionMsgId || showFullPickerForMsgId || showComposerEmojiPicker) {
          e.stopPropagation();
          setActiveReactionMsgId(null);
          setShowFullPickerForMsgId(null);
          setShowComposerEmojiPicker(false);
          return;
        }
        if (isRecording) {
          e.stopPropagation();
          cancelRecording();
          return;
        }
        if (isFullscreen) {
          e.stopPropagation();
          setIsFullscreen(false);
          return;
        }
        e.stopPropagation();
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isOpen,
    isFullscreen,
    activeViewerAttachment,
    showProfileModal,
    activeReactionMsgId,
    showFullPickerForMsgId,
    showComposerEmojiPicker,
    isRecording,
    cancelRecording,
    handleClose,
  ]);

  // Lock body scroll in fullscreen mode
  useEffect(() => {
    if (!isOpen || !isFullscreen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, isFullscreen]);

  // Fetch messages helper with safe error backoff
  const fetchMessages = useCallback(async (markRead: boolean) => {
    if (isPollingInFlightRef.current) return;
    isPollingInFlightRef.current = true;

    try {
      const q = markRead ? "mark_read=true" : "mark_read=false";
      const res = await fetch(`/api/live-chat/messages?${q}`, {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.messages)) {
          setMessages((prev) => {
            const sending = prev.filter((m) => m.status === "sending");
            const backendIds = new Set(data.messages.map((m: MessageItem) => m.id));
            const remainingSending = sending.filter((m) => !backendIds.has(m.id));
            return [...data.messages, ...remainingSending];
          });
        }
        if (typeof data.unreadVisitorCount === "number") {
          setUnreadCount(markRead ? 0 : data.unreadVisitorCount);
        }
        setConnectionStatus("connected");
        setConnectionErrorMsg("");
        backoffDelayRef.current = 3500; // Reset normal polling interval
      } else if (res.status === 401) {
        const errJson = await res.json().catch(() => ({}));
        if (errJson.code === "SESSION_SUPERSEDED" || (errJson.error && errJson.error.includes("another device"))) {
          setSessionSupersededMsg("Your account was signed in on another device. Please log in again.");
          setProfile((prev) => ({ ...prev, emailVerified: false, visitorEmail: "" }));
          setMessages([]);
        }
      } else if (res.status === 503 || res.status === 500) {
        const errJson = await res.json().catch(() => ({}));
        setConnectionStatus("reconnecting");
        setConnectionErrorMsg(errJson.error || "Connecting to live chat...");
        // Increase backoff delay exponentially up to 30s
        backoffDelayRef.current = Math.min(backoffDelayRef.current * 1.5, 30000);
      }
    } catch {
      setConnectionStatus("reconnecting");
      setConnectionErrorMsg("Reconnecting...");
      backoffDelayRef.current = Math.min(backoffDelayRef.current * 1.5, 30000);
    } finally {
      isPollingInFlightRef.current = false;
    }
  }, []);

  // Initial session & messages load
  useEffect(() => {
    let active = true;
    const loadSessionAndMessages = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const res = await fetch("/api/live-chat/session", {
          credentials: "include",
        });
        if (active && res.ok) {
          const data = await res.json();
          if (data.conversationId) {
            setConversationId(data.conversationId);
          }
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
        } else if (active && res.status === 401) {
          const errJson = await res.json().catch(() => ({}));
          if (errJson.code === "SESSION_SUPERSEDED" || (errJson.error && errJson.error.includes("another device"))) {
            setSessionSupersededMsg("Your account was signed in on another device. Please log in again.");
            setProfile((prev) => ({ ...prev, emailVerified: false, visitorEmail: "" }));
            setMessages([]);
          }
        }

        if (urlParams.get("live_chat") === "open") {
          handleOpen();
        }
      } catch (e) {
        console.warn("[Live Chat] Session init failed:", e);
      }

      if (active) {
        await fetchMessages(false);
      }
    };

    loadSessionAndMessages();
    return () => {
      active = false;
    };
  }, [fetchMessages]);

  // Polling loop with backoff when chat is open
  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    let timerId: NodeJS.Timeout;

    const runPollLoop = async () => {
      if (!active) return;
      await fetchMessages(true);
      if (active) {
        timerId = setTimeout(runPollLoop, backoffDelayRef.current);
      }
    };

    runPollLoop();

    return () => {
      active = false;
      clearTimeout(timerId);
    };
  }, [isOpen, fetchMessages]);

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
            snippet: (replyingTo.content || "").slice(0, 80),
          }
        : null,
      attachments: hasAttachments ? [...pendingAttachments] : undefined,
    };

    const clientMeta =
      typeof window !== "undefined"
        ? {
            screenResolution: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
            viewportDimensions: `${window.innerWidth}x${window.innerHeight}`,
            deviceLanguage: navigator.language || "en",
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }
        : undefined;

    const payload = {
      content: text,
      replyToId: replyingTo ? replyingTo.id : undefined,
      attachmentIds: pendingAttachments.map((a) => a.id),
      clientMessageId: tempId,
      clientMeta,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setInputValue("");
    setReplyingTo(null);
    setPendingAttachments([]);
    setIsSending(true);

    try {
      const res = await fetch("/api/live-chat/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.message?.conversationId && !conversationId) {
          setConversationId(data.message.conversationId);
        }
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
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m)),
        );
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
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_DOCUMENT_IMAGE_AUDIO_SIZE;

    if (file.size > maxSize) {
      setUploadError(`File exceeds ${isVideo ? "50MB" : "25MB"} limit.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (conversationId) {
        formData.append("conversationId", conversationId);
      }

      const res = await fetch("/api/live-chat/attachments", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.attachment) {
        if (data.attachment.conversationId && !conversationId) {
          setConversationId(data.attachment.conversationId);
        }
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
    setActiveReactionMsgId(null);
    setShowFullPickerForMsgId(null);

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

  // Handle saving edited message
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

  // Handle deleting message
  const handleDeleteMessage = async (messageId: string) => {
    try {
      const res = await fetch("/api/live-chat/messages", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });

      if (res.ok) {
        // Visitor deletion: message disappears immediately from visitor's view
        // while original content and timestamps remain safely visible to admin
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        setDeletingMsgId(null);
      }
    } catch (e) {
      console.warn("[Delete Error]:", e);
    }
  };

  // Copy text to clipboard helper
  const handleCopyText = (content: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(content);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2000);
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
        setOtpMessage("Verification code sent! Check your inbox.");
      } else {
        setOtpError(data.error || "Failed to send code.");
        if (data.retryAfter) {
          setOtpCooldown(data.retryAfter);
        }
      }
    } catch {
      setOtpError("Network error. Please try again.");
    } finally {
      setOtpSending(false);
    }
  };

  // Verify Email OTP
  const handleVerifyOtp = async () => {
    const code = otpCode.trim();
    const email = profileForm.visitorEmail.trim().toLowerCase();
    if (!/^\d{6}$/.test(code)) {
      setOtpError("Enter 6-digit code.");
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
          visitorName: data.visitorName || prev.visitorName,
          emailVerified: true,
          emailNotificationsEnabled: true,
        }));
        setProfileForm((prev) => ({
          ...prev,
          visitorEmail: email,
          visitorName: data.visitorName || prev.visitorName,
          emailVerified: true,
          emailNotificationsEnabled: true,
        }));
        setOtpMessage(
          data.message ||
            (data.restored
              ? "Email verified! Previous chat history restored."
              : "Email verified! Reply alerts are now active."),
        );
        setOtpCode("");
        setOtpSent(false);

        // Immediately fetch restored messages into view
        await fetchMessages(true);
      } else {
        setOtpError(data.error || "Verification failed.");
      }
    } catch {
      setOtpError("Network error verifying code.");
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
        }, 1000);
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
      {/* Attachment Fullscreen Viewer Modal */}
      {activeViewerAttachment && (
        <AttachmentViewerModal
          attachment={activeViewerAttachment}
          allAttachments={activeViewerList}
          onClose={() => setActiveViewerAttachment(null)}
          onNavigate={(att) => setActiveViewerAttachment(att as AttachmentItem)}
        />
      )}

      {/* Floating Copied Toast */}
      {copiedToast && (
        <div className="fixed bottom-28 right-8 z-60 bg-[#17212b] border border-cyan-500/40 text-cyan-300 text-xs px-3 py-1.5 rounded-xl shadow-2xl animate-in fade-in duration-150 font-mono flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5" />
          <span>Copied to clipboard</span>
        </div>
      )}

      {/* Floating Launcher Trigger Pill */}
      <button
        ref={launcherRef}
        type="button"
        onClick={() => {
          handleToggle();
          if (!isOpen && unreadCount > 0) {
            setUnreadCount(0);
          }
        }}
        aria-label="Live Chat with Ganganathan"
        aria-expanded={isOpen}
        title="Live Chat with Ganganathan"
        className="fixed bottom-6 right-22 sm:bottom-8 sm:right-26 z-40 p-2 rounded-full bg-[#0e1621]/90 backdrop-blur-md border border-cyan-500/30 hover:border-cyan-400 hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-xl group"
      >
        <Image
          src={LIVE_CHAT_ICON}
          alt="Live Chat"
          width={56}
          height={56}
          className="object-contain drop-shadow-2xl w-12 h-12 sm:w-14 sm:h-14 transition-transform group-hover:scale-110"
        />
        <span className="sr-only">Toggle Live Chat with Ganganathan</span>

        {/* Online pulse indicator */}
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-400"></span>
        </span>

        {/* Unread badge */}
        {unreadCount > 0 && !isOpen && (
          <span className="absolute -top-2 -left-2 bg-pink-500 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#0e1621] animate-bounce shadow-md">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Telegram-Inspired Live Chat Window */}
      {isOpen && (
        <div
          ref={chatRef}
          data-lenis-prevent
          data-lenis-prevent-touch
          role="dialog"
          aria-label="Telegram Live Chat"
          className={
            isFullscreen
              ? "fixed inset-0 z-50 w-screen h-screen md:h-[100dvh] bg-[#0e1621] shadow-2xl flex flex-col overflow-hidden text-white font-sans select-none animate-in fade-in duration-200"
              : "fixed bottom-24 right-4 sm:right-24 w-[calc(100vw-2rem)] sm:w-96 md:w-[420px] h-[78vh] max-h-[640px] z-50 rounded-2xl border border-white/10 bg-[#0e1621] shadow-2xl flex flex-col overflow-hidden text-white font-sans select-none"
          }
        >
          {/* Telegram Header */}
          <header className="px-4 py-3 border-b border-white/10 bg-[#17212b] flex justify-between items-center select-none shadow-sm shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-linear-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                  G
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#17212b] ${
                    isOnline ? "bg-emerald-400" : "bg-gray-400"
                  }`}
                />
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold text-white tracking-tight">
                    Ganganathan
                  </h3>
                  {profile.emailVerified && (
                    <span title="Verified Session">
                      <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 inline" />
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400">
                  {connectionStatus === "reconnecting" ? (
                    <span className="text-amber-400 flex items-center gap-1 font-mono">
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" /> {connectionErrorMsg || "Connecting..."}
                    </span>
                  ) : profile.emailVerified ? (
                    <span className="text-emerald-400 font-mono">online • email alerts active</span>
                  ) : profile.visitorEmail ? (
                    <span className="text-amber-400 font-mono">online • email unverified</span>
                  ) : (
                    <span className="text-cyan-400/80 font-mono">online • anonymous guest</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowProfileModal(true)}
                title="Chat & Notification Settings"
                className="w-8 h-8 rounded-full text-gray-400 hover:text-cyan-300 hover:bg-white/5 transition-colors flex items-center justify-center cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* Fullscreen / Minimize Toggle Button */}
              <button
                type="button"
                onClick={() => setIsFullscreen(!isFullscreen)}
                aria-label={isFullscreen ? "Exit fullscreen" : "Expand to fullscreen"}
                title={isFullscreen ? "Exit fullscreen" : "Expand to fullscreen"}
                className="w-8 h-8 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center cursor-pointer"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={handleClose}
                title="Close Chat (Esc)"
                className="w-8 h-8 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Reconnecting Banner if Service Unavailable */}
          {connectionStatus === "reconnecting" && (
            <div className="bg-amber-950/60 border-b border-amber-800/50 px-3 py-1.5 text-amber-200 text-xs flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-[11px] truncate">
                  {connectionErrorMsg || "Live chat service reconnecting..."}
                </span>
              </span>
              <button
                type="button"
                onClick={() => fetchMessages(true)}
                className="text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded cursor-pointer shrink-0 font-mono"
              >
                Retry Now
              </button>
            </div>
          )}

          {/* Guest Mode Notice */}
          {!profile.visitorEmail && connectionStatus === "connected" && (
            <div className="bg-cyan-950/40 border-b border-cyan-800/30 px-3 py-1 text-cyan-300 text-[11px] flex items-center justify-between">
              <span>👤 Guest Chat active (no account required).</span>
              <button
                type="button"
                onClick={() => setShowProfileModal(true)}
                className="underline hover:text-white cursor-pointer font-medium ml-1"
              >
                Get email alerts / Restore chat
              </button>
            </div>
          )}

          {/* 24-Hour Message Retention Notice Banner */}
          {!dismissedRetentionNotice && (
            <div className="bg-[#131b26] border-b border-cyan-500/25 px-3 py-1.5 text-gray-300 text-[11px] flex items-start justify-between gap-2 shadow-xs shrink-0">
              <div className="flex items-start gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <span className="leading-snug text-gray-300">
                  Messages are automatically and permanently deleted 24 hours after they are read by the recipient. Deleted messages cannot be recovered or viewed again.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDismissedRetentionNotice(true)}
                title="Dismiss retention notice"
                className="text-gray-400 hover:text-white p-0.5 shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Profile / OTP Settings Modal */}
          {showProfileModal && (
            <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-xs p-4 flex flex-col justify-center items-center overflow-y-auto">
              <div className="bg-[#17212b] border border-white/10 rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4">
                <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
                  <div>
                    <h4 className="text-white font-bold text-sm">Chat Settings & Alerts</h4>
                    <p className="text-[10px] text-gray-400">Guest chat is private to this browser session.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowProfileModal(false)}
                    className="text-gray-400 hover:text-white p-1 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
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
                      className="w-full bg-[#0e1621] border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-gray-400 font-mono">Your Email (Optional)</label>
                      {isCurrentEmailVerified && (
                        <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" /> Verified
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
                      className="w-full bg-[#0e1621] border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-400"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      Leave empty to continue chatting anonymously.
                    </p>
                  </div>

                  {/* OTP Verification Section */}
                  {profileForm.visitorEmail.trim() !== "" && !isCurrentEmailVerified && (
                    <div className="bg-[#0e1621] border border-cyan-500/20 rounded-xl p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-cyan-300">
                          Verify Email for Alerts & History Restoration
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
                            {otpVerifying ? "..." : "Verify"}
                          </button>
                        </div>
                      )}

                      {otpMessage && <p className="text-emerald-400 text-[10px]">{otpMessage}</p>}
                      {otpError && <p className="text-red-400 text-[10px]">{otpError}</p>}
                    </div>
                  )}

                  {/* Notification Consent */}
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
                      Email me when Ganganathan replies (requires verified email).
                    </label>
                  </div>

                  {profileError && <p className="text-red-400 text-[11px] pt-1">{profileError}</p>}
                  {profileSuccess && <p className="text-emerald-400 text-[11px] pt-1">Settings saved!</p>}

                  {/* 24-Hour Retention Policy in Settings */}
                  <div className="bg-[#0e1621] border border-cyan-500/20 rounded-xl p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-cyan-300 font-bold text-[11px]">
                      <Clock className="w-3.5 h-3.5" />
                      <span>24-Hour Message Retention Policy</span>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-relaxed">
                      Messages are automatically and permanently deleted 24 hours after they are read by the recipient. Deleted messages cannot be recovered or viewed again.
                    </p>
                    {dismissedRetentionNotice && (
                      <button
                        type="button"
                        onClick={() => setDismissedRetentionNotice(false)}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 underline font-mono cursor-pointer pt-0.5 block"
                      >
                        Restore retention banner in chat
                      </button>
                    )}
                  </div>

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
              <div className="bg-[#17212b] border border-red-500/30 rounded-2xl p-4 w-full max-w-xs text-center space-y-3 shadow-2xl">
                <Trash2 className="w-8 h-8 text-red-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">Delete Message?</h4>
                <p className="text-xs text-gray-400">
                  This message will be removed for everyone in this chat.
                </p>
                <div className="flex justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setDeletingMsgId(null)}
                    className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteMessage(deletingMsgId)}
                    className="bg-red-500 hover:bg-red-400 text-white font-bold px-4 py-1.5 rounded-lg text-xs cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Telegram Messages Stream */}
          <section
            data-lenis-prevent
            className="custom-scrollbar flex-1 overflow-y-auto px-3 py-4 space-y-2.5 bg-[#0e1621]"
          >
            {sessionSupersededMsg && (
              <div className="bg-red-950/90 border border-red-500/50 text-red-200 text-xs p-3 rounded-xl flex items-center justify-between gap-2 shadow-lg mb-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{sessionSupersededMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSessionSupersededMsg("");
                    setShowProfileModal(true);
                  }}
                  className="bg-red-600 hover:bg-red-500 text-white font-bold px-2.5 py-1 rounded-lg text-xs cursor-pointer shrink-0 transition-colors"
                >
                  Log in
                </button>
              </div>
            )}

            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400 space-y-2 select-none">
                <div className="w-14 h-14 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400 mb-1">
                  <Send className="w-6 h-6 rotate-45 ml-1" />
                </div>
                <p className="text-sm font-semibold text-gray-200">
                  Direct Live Chat with Ganganathan
                </p>
                <p className="text-xs text-gray-400 leading-relaxed max-w-xs">
                  Send a message about contracts, full-stack development, or general inquiries. Replies arrive directly here.
                </p>
                {!profile.visitorEmail && (
                  <button
                    type="button"
                    onClick={() => setShowProfileModal(true)}
                    className="text-xs text-cyan-400 hover:underline pt-2 cursor-pointer font-medium"
                  >
                    + Add email for instant reply notifications
                  </button>
                )}
              </div>
            ) : (
              messages.map((m, idx) => {
                const isVisitor = m.senderType === "visitor";
                const isEditing = editingMessageId === m.id;

                // Date separator logic
                const currentDate = new Date(m.createdAt).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
                const prevDate =
                  idx > 0
                    ? new Date(messages[idx - 1].createdAt).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "";
                const showDateHeader = currentDate !== prevDate;

                return (
                  <React.Fragment key={m.id}>
                    {/* Date Separator Pill */}
                    {showDateHeader && (
                      <div className="flex justify-center my-3 select-none">
                        <span className="bg-[#17212b]/80 border border-white/5 text-gray-400 text-[10px] font-semibold px-3 py-0.5 rounded-full shadow-xs">
                          {currentDate}
                        </span>
                      </div>
                    )}

                    <div
                      className={`flex flex-col group relative ${
                        isVisitor ? "items-end" : "items-start"
                      }`}
                    >
                      {/* Quoted Reply Reference */}
                      {m.replyPreview && (
                        <div
                          className={`mb-0.5 text-[11px] px-2.5 py-1 rounded-t-xl bg-black/30 border-l-2 max-w-[85%] truncate flex items-center gap-1.5 ${
                            isVisitor
                              ? "border-cyan-300 text-cyan-200 mr-1"
                              : "border-purple-400 text-purple-200 ml-1"
                          }`}
                        >
                          <Reply className="w-3 h-3 rotate-180 shrink-0 opacity-70" />
                          <span className="font-bold shrink-0">
                            {m.replyPreview.senderType === "owner" ? "Ganganathan" : "You"}:
                          </span>
                          <span className="truncate opacity-90">
                            {m.replyPreview.snippet || m.replyPreview.content}
                          </span>
                        </div>
                      )}

                      {/* Telegram Message Bubble */}
                      <div
                        className={`relative p-3 rounded-2xl text-xs sm:text-[13px] max-w-[85%] sm:max-w-[80%] break-words leading-relaxed shadow-sm ${
                          isVisitor
                            ? "bg-[#1c5b78] text-white rounded-br-xs"
                            : "bg-[#182533] text-gray-100 rounded-bl-xs border border-white/5"
                        } ${m.isDeleted ? "italic opacity-60 bg-white/5 text-gray-400" : ""}`}
                      >
                        {isEditing ? (
                          <div className="space-y-2 min-w-[200px]">
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="w-full bg-[#0e1621] border border-cyan-400 rounded-lg p-2 text-white text-xs outline-none focus:ring-1 focus:ring-cyan-400"
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
                              <span className="text-[10px] text-cyan-200/80 font-mono ml-1.5 opacity-80">
                                (edited)
                              </span>
                            )}
                          </div>
                        )}

                        {/* Media & Attachments */}
                        {m.attachments && m.attachments.length > 0 && !m.isDeleted && (
                          <div className="mt-2 pt-2 border-t border-white/10 space-y-1.5">
                            {/* If multiple attachments, show Download All */}
                            {m.attachments.length > 1 && (
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
                            <div className={m.attachments.length > 1 ? "grid grid-cols-2 gap-1.5" : "flex flex-col gap-1.5"}>
                              {m.attachments.map((att) => {
                                const mime = att.mimeType.toLowerCase();
                                const isImg = mime.startsWith("image/");
                                const isVid = mime.startsWith("video/");
                                const isAud = mime.startsWith("audio/");
                                const isPdf = mime === "application/pdf" || att.fileName.toLowerCase().endsWith(".pdf");
                                const streamUrl = `/api/live-chat/attachments/${att.id}`;
                                const downloadUrl = `${streamUrl}?download=true`;

                                return (
                                  <div
                                    key={att.id}
                                    className="bg-black/40 rounded-xl p-2 border border-white/10 flex flex-col gap-1.5 overflow-hidden group/card hover:border-cyan-500/40 transition-colors"
                                  >
                                    {isImg && (
                                      <div
                                        className="relative overflow-hidden rounded-lg group/img cursor-pointer max-h-48 flex items-center justify-center bg-black/60"
                                        onClick={() => {
                                          setActiveViewerAttachment(att);
                                          setActiveViewerList(m.attachments || []);
                                        }}
                                      >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={streamUrl}
                                          alt={att.fileName}
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
                          </div>
                        )}

                        {/* Telegram Timestamp & Status in Bubble Corner */}
                        <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-gray-300/80 font-mono select-none">
                          <span>
                            {new Date(m.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {isVisitor && (
                            <span>
                              {m.status === "sending" && "•"}
                              {m.status === "failed" && "❌"}
                              {m.status !== "sending" && m.status !== "failed" && (
                                m.readAt ? (
                                  <span title="Read by Ganganathan">
                                    <CheckCheck className="w-3.5 h-3.5 text-cyan-300 inline" />
                                  </span>
                                ) : (
                                  <span title="Delivered">
                                    <Check className="w-3.5 h-3.5 text-gray-300 inline" />
                                  </span>
                                )
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Multi-Emoji Reaction Pills Row */}
                      {m.reactions && Object.keys(m.reactions).length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap items-center">
                          {Object.entries(m.reactions).map(([emoji, users]) => {
                            const isUserReacted = users.includes("visitor");
                            const userNames = users.map((u) => (u === "visitor" ? "You" : "Ganganathan")).join(", ");

                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleToggleReaction(m.id, emoji)}
                                className={`text-xs px-2 py-0.5 rounded-full border transition-all cursor-pointer flex items-center gap-1 shadow-xs ${
                                  isUserReacted
                                    ? "bg-cyan-500/30 border-cyan-400 text-cyan-200 font-bold scale-105"
                                    : "bg-[#17212b] border-white/10 text-gray-300 hover:text-white hover:border-white/20"
                                }`}
                                title={`Reacted by: ${userNames}`}
                              >
                                <span className="text-sm">{emoji}</span>
                                <span className="font-mono text-[10px]">{users.length}</span>
                              </button>
                            );
                          })}

                          {/* Quick Plus Reaction Button */}
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

                      {/* Hover / Tap Action Menu */}
                      {!m.isDeleted && (
                        <div className="opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-1 px-1 text-gray-400">
                          {/* Reply Action */}
                          <button
                            type="button"
                            onClick={() => setReplyingTo(m)}
                            className="p-1 rounded-md hover:bg-white/10 hover:text-cyan-300 transition-colors cursor-pointer"
                            title="Reply with quote"
                          >
                            <Reply className="w-3.5 h-3.5" />
                          </button>

                          {/* React Action */}
                          <button
                            type="button"
                            onClick={() =>
                              setActiveReactionMsgId(activeReactionMsgId === m.id ? null : m.id)
                            }
                            className="p-1 rounded-md hover:bg-white/10 hover:text-yellow-400 transition-colors cursor-pointer"
                            title="React to message"
                          >
                            <SmilePlus className="w-3.5 h-3.5" />
                          </button>

                          {/* Copy Text */}
                          <button
                            type="button"
                            onClick={() => handleCopyText(m.content)}
                            className="p-1 rounded-md hover:bg-white/10 hover:text-gray-200 transition-colors cursor-pointer"
                            title="Copy text"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {/* Visitor Edit & Delete Own Messages */}
                          {isVisitor && (
                            <>
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

                              <button
                                type="button"
                                onClick={() => setDeletingMsgId(m.id)}
                                className="p-1 rounded-md hover:bg-white/10 hover:text-red-400 transition-colors cursor-pointer"
                                title="Delete message"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      {/* Quick Telegram Emoji Reactions Bar */}
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

                            {/* More Emojis Button -> Opens Full Categorized Picker */}
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

                      {/* Full Categorized Emoji Picker Drawer for Message Reaction */}
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
          </section>

          {/* Telegram Composer Footer */}
          <footer className="p-3 border-t border-white/10 bg-[#17212b] space-y-2 relative">
            {/* Full Emoji Picker Drawer for Composer */}
            {showComposerEmojiPicker && (
              <div className="absolute bottom-16 left-3 z-50">
                <TelegramEmojiPicker
                  mode="composer"
                  onSelect={(emoji) => {
                    setInputValue((prev) => prev + emoji);
                    inputRef.current?.focus();
                  }}
                  onClose={() => setShowComposerEmojiPicker(false)}
                />
              </div>
            )}

            {/* Quoting Preview Banner */}
            {replyingTo && (
              <div className="flex items-center justify-between bg-[#0e1621] border-l-3 border-cyan-400 rounded-r-xl px-3 py-1.5 text-xs">
                <div className="flex items-center gap-1.5 truncate">
                  <Reply className="w-3.5 h-3.5 text-cyan-400 shrink-0 rotate-180" />
                  <span className="font-semibold text-cyan-300 shrink-0">
                    {replyingTo.senderType === "owner" ? "Ganganathan" : "You"}:
                  </span>
                  <span className="text-gray-400 truncate">
                    {replyingTo.content.slice(0, 50)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="text-gray-400 hover:text-white p-0.5 ml-2 cursor-pointer"
                  title="Cancel reply"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Pending Attachments List */}
            {pendingAttachments.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {pendingAttachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-1.5 bg-[#0e1621] border border-cyan-500/30 text-cyan-200 text-xs px-2.5 py-1 rounded-lg"
                  >
                    <Paperclip className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span className="truncate max-w-[130px] font-mono">{att.fileName}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingAttachments((prev) => prev.filter((a) => a.id !== att.id))
                      }
                      className="text-gray-400 hover:text-white cursor-pointer ml-1"
                      title="Remove attachment"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Uploading Status / Error */}
            {isUploadingAttachment && (
              <p className="text-[10px] text-cyan-300 font-mono animate-pulse flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Uploading attachment...</span>
              </p>
            )}
            {uploadError && (
              <p className="text-[10px] text-red-400 font-mono flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                <span>{uploadError}</span>
              </p>
            )}

            {/* Voice Error Notification */}
            {voiceError && (
              <div className="bg-red-500/15 border border-red-500/30 rounded-xl px-3 py-1.5 flex items-center justify-between text-xs text-red-300 font-mono">
                <span className="flex items-center gap-1.5 truncate">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                  <span className="truncate">{voiceError}</span>
                </span>
                <button
                  type="button"
                  onClick={clearVoiceError}
                  className="text-red-300 hover:text-white p-0.5 ml-2 cursor-pointer"
                  title="Dismiss error"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Active Voice Recording Status Bar */}
            {isRecording ? (
              <div className="flex items-center justify-between bg-red-500/10 border border-red-500/30 rounded-2xl p-2.5 px-4 animate-pulse">
                <div className="flex items-center gap-2 text-xs font-mono text-red-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  <span className="font-bold">Listening...</span>
                  <span className="text-gray-400">
                    {Math.floor(recordingDuration / 60)}:
                    {String(recordingDuration % 60).padStart(2, "0")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white text-xs font-mono flex items-center gap-1 cursor-pointer transition-colors"
                    title="Cancel recording"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="p-1.5 px-3 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-lg"
                    title="Finish voice input"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Done</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Input Form Row */
              <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {/* Attachment Button */}
                <button
                  type="button"
                  disabled={isUploadingAttachment || isSending}
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-xl text-gray-400 hover:text-cyan-300 hover:bg-white/5 transition-colors disabled:opacity-40 cursor-pointer shrink-0"
                  title="Attach file, image, or video"
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

                {/* Voice Input Button */}
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={isSending || isUploadingAttachment}
                  className="p-2 rounded-xl text-gray-400 hover:text-cyan-300 hover:bg-white/5 transition-colors disabled:opacity-40 cursor-pointer shrink-0"
                  title="Voice message (Speech Input)"
                >
                  <Mic className="w-5 h-5" />
                </button>

                {/* Message Text Input */}
                <input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  maxLength={2000}
                  disabled={isSending}
                  placeholder={
                    pendingAttachments.length > 0
                      ? "Add a caption..."
                      : "Write a message..."
                  }
                  className="flex-1 bg-[#0e1621] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder:text-gray-500 outline-none border border-white/10 focus:border-cyan-400 transition-colors disabled:opacity-50"
                />

                {/* Telegram Send Button */}
                <button
                  type="submit"
                  disabled={isSending || (!inputValue.trim() && pendingAttachments.length === 0)}
                  className="w-9 h-9 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0 cursor-pointer shadow-md"
                  title="Send message"
                >
                  {isSending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 ml-0.5" />
                  )}
                </button>
              </form>
            )}
          </footer>
        </div>
      )}
    </>
  );
}
