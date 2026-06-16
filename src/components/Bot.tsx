"use client";
import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import BOT_IMG from "../../public/assets/bot/Livechatbot.svg";

interface Message {
  role: "user" | "bot";
  text: string;
}

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "bot", text: "Hello! Ready to explore my portfolio?" },
  ]);
  const [input, setInput] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  // Animation for Chat Window
  useGSAP(() => {
    if (isOpen) {
      gsap.fromTo(
        chatRef.current,
        { y: 20, opacity: 0, scale: 0.95 },
        { y: 0, opacity: 1, scale: 1, duration: 0.3 },
      );
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg: Message = { role: "user", text: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ prompt: input }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "bot", text: data.reply }]);
    } catch (err) {
      console.error("API Error:", err);
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 p-0 bg-transparent hover:scale-110 transition-all flex items-center justify-center cursor-pointer"
      >
        <Image
          src={BOT_IMG}
          alt="AI Bot"
          className="object-contain drop-shadow-2xl w-20 h-20 md:w-28 md:h-28 lg:w-36 lg:h-36"
        />
      </div>

      {/* Floating Chat Window */}
      {isOpen && (
        <div
          data-lenis-prevent
          data-lenis-prevent-touch
          ref={chatRef}
          className="fixed overscroll-contain bottom-24 right-6 w-80 h-[70%] z-50 rounded-3xl border border-white/10 bg-[#0a0a0c] shadow-2xl flex flex-col overflow-hidden"
        >
          <header className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
            <span className="text-[10px] uppercase tracking-widest text-secondary font-mono">
              GANGANATHAN_AI
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white"
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
                  className={`p-3 rounded-2xl text-sm max-w-[85%] ${msg.role === "bot" ? "bg-white/5" : "bg-accent"}`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </section>

          <footer className="p-3 border-t border-white/10">
            <form onSubmit={handleSend} className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything..."
                className="flex-1 bg-white/5 rounded-xl px-3 py-2 text-sm outline-none border border-white/5"
              />
              <button className="text-accent text-xs font-bold hover:text-white">
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
