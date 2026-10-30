"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  Sparkles,
  MessageSquare,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";
import AI_BOT_IMG from "../../../public/assets/bot/Ai-bot.svg";
import LIVE_CHAT_ICON from "../../../public/assets/bot/Livechatbot.svg";
import Chatbot from "@/components/Bot";
import LiveChatWidget from "@/components/LiveChat/LiveChatWidget";

interface UnifiedChatModalProps {
  initialTab?: "chatbot" | "livechat";
}

export default function UnifiedChatModal({ initialTab = "chatbot" }: UnifiedChatModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chatbot" | "livechat">(initialTab);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [liveChatUnread, setLiveChatUnread] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  // Keyboard navigation: Escape key handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isFullscreen) {
          e.stopPropagation();
          setIsFullscreen(false);
          return;
        }
        e.stopPropagation();
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isFullscreen]);

  // Outside click to close in floating mode
  useEffect(() => {
    if (!isOpen || isFullscreen) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (containerRef.current?.contains(target) || launcherRef.current?.contains(target)) {
        return;
      }

      if (target.closest('[role="dialog"]') && !containerRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
    };

    document.addEventListener("pointerdown", handleOutsideClick);
    return () => document.removeEventListener("pointerdown", handleOutsideClick);
  }, [isOpen, isFullscreen]);

  // Lock body scroll in fullscreen mode
  useEffect(() => {
    if (!isOpen || !isFullscreen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, isFullscreen]);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setIsFullscreen(false);
  }, []);

  return (
    <>
      {/* Single Bottom-Right Floating Launcher Pill */}
      <button
        ref={launcherRef}
        type="button"
        onClick={handleToggle}
        aria-label="Open Chat with Ganganathan (AI Assistant & Live Chat)"
        aria-expanded={isOpen}
        title="Chat with Ganganathan (AI Assistant & Live Chat)"
        className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40 p-2 sm:p-2.5 rounded-full bg-[#0a0e17]/90 backdrop-blur-md border border-cyan-500/40 hover:border-cyan-400 hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-2xl group ring-1 ring-cyan-500/20 hover:ring-cyan-400/40"
      >
        <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center">
          <Image
            src={AI_BOT_IMG}
            alt="AI Assistant"
            width={48}
            height={48}
            className="object-contain drop-shadow-xl w-10 h-10 sm:w-11 sm:h-11 transition-transform group-hover:scale-105"
          />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#17212b] border border-cyan-400/50 flex items-center justify-center shadow-md">
            <Image
              src={LIVE_CHAT_ICON}
              alt="Live Chat"
              width={16}
              height={16}
              className="object-contain w-4 h-4"
            />
          </div>
        </div>

        <span className="sr-only">Toggle Unified Chat</span>

        {/* Pulse online indicator */}
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-400"></span>
        </span>

        {/* Unread badge from Live Chat */}
        {liveChatUnread > 0 && !isOpen && (
          <span className="absolute -top-2 -left-2 bg-pink-500 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#0a0e17] animate-bounce shadow-md">
            {liveChatUnread}
          </span>
        )}
      </button>

      {/* Unified Floating Window Modal */}
      {isOpen && (
        <div
          ref={containerRef}
          data-lenis-prevent
          data-lenis-prevent-touch
          role="dialog"
          aria-modal="true"
          aria-label="Unified Portfolio Chat Window"
          className={
            isFullscreen
              ? "fixed inset-0 z-50 w-screen h-screen md:h-[100dvh] bg-[#0c1017] flex flex-col overflow-hidden text-white font-sans select-none animate-in fade-in duration-200"
              : "fixed bottom-24 right-4 sm:right-8 w-[calc(100vw-2rem)] sm:w-96 md:w-[440px] h-[78vh] max-h-[640px] z-50 rounded-2xl border border-white/10 bg-[#0c1017] shadow-2xl flex flex-col overflow-hidden text-white font-sans select-none"
          }
        >
          {/* Top Segmented Tab Header */}
          <header className="px-3 py-2.5 sm:px-4 sm:py-3 border-b border-white/10 bg-[#121824] flex items-center justify-between select-none shadow-sm shrink-0">
            {/* Segmented Control Tabs */}
            <div className="flex items-center bg-[#070a10] p-1 rounded-xl border border-white/5 text-xs font-mono">
              <button
                type="button"
                onClick={() => setActiveTab("chatbot")}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === "chatbot"
                    ? "bg-cyan-500 text-black font-bold shadow-md"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Assistant</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("livechat");
                  setLiveChatUnread(0);
                }}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer relative ${
                  activeTab === "livechat"
                    ? "bg-cyan-500 text-black font-bold shadow-md"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Live Chat</span>
                {liveChatUnread > 0 && activeTab !== "livechat" && (
                  <span className="w-2 h-2 rounded-full bg-pink-500 inline-block shrink-0" />
                )}
              </button>
            </div>

            {/* Window Controls */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsFullscreen(!isFullscreen)}
                aria-label={isFullscreen ? "Exit fullscreen" : "Expand to fullscreen"}
                title={isFullscreen ? "Exit fullscreen" : "Expand to fullscreen"}
                className="w-8 h-8 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center cursor-pointer"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={handleClose}
                aria-label="Close Chat"
                title="Close (Esc)"
                className="w-8 h-8 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Unified Body Panels: Kept simultaneously mounted in DOM to prevent state reset */}
          <div className="flex-1 w-full h-full relative overflow-hidden flex flex-col">
            <div className={activeTab === "chatbot" ? "flex-1 w-full h-full flex flex-col min-h-0" : "hidden"}>
              <Chatbot isEmbedded isFullscreen={isFullscreen} />
            </div>

            <div className={activeTab === "livechat" ? "flex-1 w-full h-full flex flex-col min-h-0" : "hidden"}>
              <LiveChatWidget
                isEmbedded
                isFullscreen={isFullscreen}
                onUnreadCountChange={setLiveChatUnread}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

