"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import AI_BOT_IMG from "../../public/assets/bot/Ai-bot.svg";
import {
  Mic,
  Square,
  X,
  Maximize2,
  Minimize2,
  AlertCircle,
  Send,
} from "lucide-react";
import { useVoiceRecording } from "./LiveChat/useVoiceRecording";
import { useChatResponsiveViewport } from "./UnifiedChat/useChatResponsiveViewport";

interface Message {
  role: "user" | "bot";
  text: string;
}

interface ChatbotProps {
  isOpen?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
  isEmbedded?: boolean;
  isFullscreen?: boolean;
}

const Chatbot = ({
  isOpen: controlledIsOpen,
  onToggle: controlledOnToggle,
  onClose: controlledOnClose,
  isEmbedded = false,
  isFullscreen: controlledIsFullscreen,
}: ChatbotProps = {}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = isEmbedded ? true : (typeof controlledIsOpen === "boolean" ? controlledIsOpen : internalIsOpen);

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

  const [internalIsFullscreen, setInternalIsFullscreen] = useState(false);
  const isFullscreen = typeof controlledIsFullscreen === "boolean" ? controlledIsFullscreen : internalIsFullscreen;
  const setIsFullscreen = setInternalIsFullscreen;
  const [messages, setMessages] = useState<Message[]>([
    { role: "bot", text: "Hello! Ready to explore my portfolio?" },
  ]);
  const [userName, setUserName] = useState("Visitor");
  const [botNickname, setBotNickname] = useState("Ganganathan's AI Assistant");
  const [input, setInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    visualHeight,
    isKeyboardOpen,
    keyboardHeight,
    isMobile,
    offsetTop,
  } = useChatResponsiveViewport(isOpen, isFullscreen);

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
      setInput(transcript);
    },
  });

  // Animation for Chat Window when opening (standalone mode only)
  useGSAP(() => {
    if (isOpen && chatRef.current && !isFullscreen && !isEmbedded) {
      gsap.fromTo(
        chatRef.current,
        { y: 20, opacity: 0, scale: 0.95 },
        { y: 0, opacity: 1, scale: 1, duration: 0.25, ease: "power2.out" },
      );
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [isOpen, isFullscreen, isEmbedded]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Auto-scroll when keyboard opens on mobile
  useEffect(() => {
    if (isKeyboardOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isKeyboardOpen]);

  // Handle Escape key: cancel voice -> exit fullscreen -> close chat
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
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
  }, [isOpen, isFullscreen, isRecording, cancelRecording, handleClose, setIsFullscreen]);

  // Outside-click-to-close behavior in floating mode
  useEffect(() => {
    if (!isOpen || isFullscreen) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Do not close if click was inside chat window or launcher button
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

  // Lock body scroll in fullscreen mode
  useEffect(() => {
    if (!isOpen || !isFullscreen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, isFullscreen]);

  const handleSend = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (isRecording) {
      stopRecording();
    }

    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    const userMsg: Message = { role: "user", text: trimmedInput };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");

    let currentName = userName;
    let customReply = "";

    // 1. Name logic
    if (trimmedInput.toLowerCase().includes("my name is")) {
      const parts = trimmedInput.split(/is/i);
      const name = parts[parts.length - 1]?.trim().replace(/[.!?,]/g, "");
      if (name) {
        setUserName(name);
        currentName = name;
        customReply = `Nice to meet you, ${name}! I'll remember that.`;
      }
    }

    // 2. Nickname logic
    if (trimmedInput.toLowerCase().includes("nickname")) {
      const namePart =
        trimmedInput.split(/is/i)[1]?.trim() ||
        trimmedInput.split(/called/i)[1]?.trim();
      if (namePart) {
        const cleaned = namePart.replace(/[.!?,]/g, "");
        setBotNickname(cleaned);
        customReply = `Got it! From now on, call me ${cleaned}.`;
      }
    }

    // 3. Custom instant reply if rule matched
    if (customReply) {
      setMessages((prev) => [...prev, { role: "bot", text: customReply }]);
      return;
    }

    // 4. API Call with loading indicator
    setIsLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: updatedMessages,
          userName: currentName,
          botNickname: botNickname,
        }),
      });

      const data = await res.json().catch(() => null);

      if (data && data.reply) {
        setMessages((prev) => [...prev, { role: "bot", text: data.reply }]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "bot",
            text: "I'm having a brief connection pause. Feel free to try again or reach out through the Live Chat!",
          },
        ]);
      }
    } catch (err) {
      console.error("AI Chat API Error:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: "Unable to reach my neural network right now. Please check your internet connection or try again shortly.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Button for AI Chatbot (Standalone mode only) */}
      {!isEmbedded && (
        <button
          ref={launcherRef}
          type="button"
          onClick={handleToggle}
          aria-label="Open Ganganathan's AI Assistant"
          aria-expanded={isOpen}
          title="Ganganathan's AI Assistant"
          className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40 p-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 hover:border-cyan-400/50 hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-xl group"
        >
          <Image
            src={AI_BOT_IMG}
            alt="AI Bot"
            width={56}
            height={56}
            className="object-contain drop-shadow-2xl w-12 h-12 sm:w-14 sm:h-14 transition-transform group-hover:rotate-6"
          />
          <span className="sr-only">Toggle AI Assistant</span>
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-400"></span>
          </span>
        </button>
      )}

      {/* Chat Window: Either Floating Window, Dedicated Fullscreen Workspace, or Embedded Panel */}
      {isOpen && (
        <div
          data-lenis-prevent
          data-lenis-prevent-touch
          ref={chatRef}
          role={isEmbedded ? "region" : "dialog"}
          aria-modal={isEmbedded ? undefined : "true"}
          aria-label="Ganganathan AI Assistant"
          style={
            !isEmbedded
              ? isFullscreen
                ? {
                    height: visualHeight ? `${visualHeight}px` : "100dvh",
                    maxHeight: visualHeight ? `${visualHeight}px` : "100dvh",
                    top: offsetTop > 0 ? `${offsetTop}px` : 0,
                    paddingTop: "env(safe-area-inset-top, 0px)",
                    paddingBottom: isKeyboardOpen ? "0px" : "env(safe-area-inset-bottom, 0px)",
                    paddingLeft: "env(safe-area-inset-left, 0px)",
                    paddingRight: "env(safe-area-inset-right, 0px)",
                  }
                : isMobile
                ? {
                    bottom: isKeyboardOpen
                      ? `${keyboardHeight + 6}px`
                      : "max(0.75rem, env(safe-area-inset-bottom, 0px))",
                    height: isKeyboardOpen
                      ? `${Math.min(480, Math.max(260, visualHeight - 16))}px`
                      : "min(580px, calc(100dvh - 5.5rem))",
                    maxHeight: `${Math.max(260, visualHeight - (isKeyboardOpen ? 12 : 24))}px`,
                  }
                : undefined
              : undefined
          }
          className={
            isEmbedded
              ? "flex-1 w-full h-full bg-[#0a0a0c] flex flex-col overflow-hidden min-h-0 min-w-0"
              : isFullscreen
              ? "fixed inset-0 z-50 w-full bg-[#0a0a0c] flex flex-col overflow-hidden text-white animate-in fade-in duration-200"
              : "fixed bottom-20 sm:bottom-24 left-3 right-3 sm:left-auto sm:right-8 w-auto sm:w-88 md:w-96 max-w-[calc(100vw-1.5rem)] sm:max-w-none h-[72vh] max-h-[580px] z-50 rounded-3xl border border-white/10 bg-[#0a0a0c]/98 backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden"
          }
        >
          {/* Header */}
          <header className="p-2.5 sm:p-3.5 border-b border-white/10 bg-white/5 flex justify-between items-center select-none shrink-0 min-w-0">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] uppercase tracking-widest text-cyan-400 font-mono block font-bold truncate">
                  AI ASSISTANT
                </span>
                <span className="text-xs font-semibold text-white truncate block">
                  {botNickname}
                </span>
              </div>
            </div>

            {!isEmbedded && (
              <div className="flex items-center gap-1 shrink-0 ml-1">
                {/* Fullscreen / Minimize Toggle Button */}
                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  aria-label={isFullscreen ? "Exit fullscreen" : "Expand to fullscreen"}
                  title={isFullscreen ? "Exit fullscreen" : "Expand to fullscreen"}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" />
                  )}
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close Chat"
                  title="Close (Esc)"
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors text-sm cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </header>

          {/* Voice Error Notification Banner */}
          {voiceError && (
            <div className="bg-red-500/15 border-b border-red-500/30 px-3 py-2 flex items-center justify-between text-xs text-red-300 font-mono shrink-0 min-w-0">
              <span className="flex items-center gap-1.5 truncate min-w-0">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                <span className="truncate">{voiceError}</span>
              </span>
              <button
                type="button"
                onClick={clearVoiceError}
                className="text-red-300 hover:text-white ml-2 p-0.5 shrink-0 cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Messages Scroll Area */}
          <section
            data-lenis-prevent
            data-lenis-prevent-touch
            ref={scrollRef}
            className={`custom-scrollbar flex-1 min-h-0 min-w-0 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-3 sm:space-y-4 ${
              isFullscreen ? "max-w-4xl w-full mx-auto" : ""
            }`}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`p-3 sm:p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed max-w-[85%] sm:max-w-[80%] [overflow-wrap:anywhere] break-words min-w-0 ${
                    msg.role === "bot"
                      ? "bg-white/5 text-gray-200 border border-white/5 rounded-bl-sm"
                      : "bg-cyan-500 text-black font-medium rounded-br-sm shadow-md"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="p-3 sm:p-3.5 rounded-2xl rounded-bl-sm bg-white/5 border border-white/5 text-gray-300 text-xs sm:text-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" />
                  <span className="text-xs text-gray-400 ml-2 font-mono">Thinking...</span>
                </div>
              </div>
            )}
          </section>

          {/* Composer Footer */}
          <footer
            className={`p-2.5 sm:p-3 border-t border-white/10 bg-white/5 shrink-0 min-w-0 ${
              isFullscreen ? "max-w-4xl w-full mx-auto" : ""
            }`}
          >
            {/* Active Voice Recording Status Bar */}
            {isRecording ? (
              <div className="flex items-center justify-between bg-red-500/10 border border-red-500/30 rounded-2xl p-2 px-3 sm:p-2.5 sm:px-4 animate-pulse min-w-0">
                <div className="flex items-center gap-2 text-xs font-mono text-red-400 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0" />
                  <span className="font-bold truncate">Listening...</span>
                  <span className="text-gray-400 shrink-0">
                    {Math.floor(recordingDuration / 60)}:
                    {String(recordingDuration % 60).padStart(2, "0")}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white text-xs font-mono flex items-center gap-1 cursor-pointer transition-colors"
                    title="Cancel recording"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Cancel</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="p-1.5 px-2.5 sm:px-3 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-lg"
                    title="Finish voice input"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Done</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSend} className="flex gap-1.5 sm:gap-2 items-center min-w-0 w-full">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isLoading}
                  maxLength={800}
                  placeholder="Ask a question or click mic..."
                  className="flex-1 min-w-0 bg-black/40 rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm text-white placeholder:text-gray-500 outline-none border border-white/10 focus:border-cyan-400 transition-colors disabled:opacity-50"
                />

                {/* Microphone Voice Button */}
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={isLoading}
                  aria-label="Start voice input"
                  title="Speak your question (Voice Input)"
                  className="p-2 sm:p-2.5 rounded-xl bg-white/5 hover:bg-white/15 text-gray-300 hover:text-cyan-300 border border-white/10 transition-colors cursor-pointer shrink-0 disabled:opacity-40"
                >
                  <Mic className="w-4 h-4" />
                </button>

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  aria-label="Send message"
                  className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-black px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all disabled:cursor-not-allowed shrink-0 flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <span>SEND</span>
                  <Send className="w-3 h-3" />
                </button>
              </form>
            )}
          </footer>
        </div>
      )}
    </>
  );
};

export default Chatbot;
