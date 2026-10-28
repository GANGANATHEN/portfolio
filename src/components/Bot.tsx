"use client";
import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import AI_BOT_IMG from "../../public/assets/bot/Ai-bot.svg";

interface Message {
  role: "user" | "bot";
  text: string;
}

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "bot", text: "Hello! Ready to explore my portfolio?" },
  ]);
  const [userName, setUserName] = useState("Visitor");
  const [botNickname, setBotNickname] = useState("Ganganathan's AI Assistant");
  const [input, setInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Animation for Chat Window
  useGSAP(() => {
    if (isOpen && chatRef.current) {
      gsap.fromTo(
        chatRef.current,
        { y: 20, opacity: 0, scale: 0.95 },
        { y: 0, opacity: 1, scale: 1, duration: 0.3, ease: "power2.out" },
      );
      // Auto-focus input when opened
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleSend = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
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
      {/* Floating Trigger Button for AI Chatbot */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open Ganganathan's AI Assistant"
        aria-expanded={isOpen}
        title="Ganganathan's AI Assistant"
        className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40 p-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 hover:border-accent/50 hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-xl group"
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
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-accent"></span>
        </span>
      </button>

      {/* Floating Chat Window */}
      {isOpen && (
        <div
          data-lenis-prevent
          data-lenis-prevent-touch
          ref={chatRef}
          role="dialog"
          aria-label="Ganganathan AI Assistant"
          className="fixed bottom-24 right-4 sm:right-8 w-[calc(100vw-2rem)] sm:w-88 md:w-96 h-[72vh] max-h-[580px] z-50 rounded-3xl border border-white/10 bg-[#0a0a0c]/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden"
        >
          <header className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center select-none">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <span className="text-[11px] uppercase tracking-widest text-secondary font-mono block">
                  AI ASSISTANT
                </span>
                <span className="text-xs font-semibold text-white">
                  {botNickname}
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close Chat"
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors text-sm"
            >
              ✕
            </button>
          </header>

          <section
            data-lenis-prevent
            ref={scrollRef}
            className="custom-scrollbar flex-1 overflow-y-auto p-4 space-y-4"
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`p-3.5 rounded-2xl text-sm leading-relaxed max-w-[85%] break-words ${
                    msg.role === "bot"
                      ? "bg-white/5 text-gray-200 border border-white/5 rounded-bl-sm"
                      : "bg-accent text-white font-medium rounded-br-sm"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="p-3.5 rounded-2xl rounded-bl-sm bg-white/5 border border-white/5 text-gray-300 text-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-accent animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 rounded-full bg-accent animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 rounded-full bg-accent animate-bounce" />
                  <span className="text-xs text-gray-400 ml-2 font-mono">Thinking...</span>
                </div>
              </div>
            )}
          </section>

          <footer className="p-3 border-t border-white/10 bg-white/5">
            <form onSubmit={handleSend} className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                maxLength={800}
                placeholder="Ask about Ganganathan's projects, skills..."
                className="flex-1 bg-black/40 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-gray-500 outline-none border border-white/10 focus:border-accent transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="bg-accent hover:bg-accent/80 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all disabled:cursor-not-allowed shrink-0"
              >
                SEND
              </button>
            </form>
          </footer>
        </div>
      )}
    </>
  );
};

export default Chatbot;
