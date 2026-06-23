"use client";
import React, { useState, useRef, useEffect } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import Image from "next/image";
import logo from "../../public/assets/logo.svg";

interface Message {
  role: "user" | "bot";
  text: string;
}

interface ChatSession {
  id: number;
  title: string;
  messages: Message[];
}

const Chatbot = () => {
  const [mounted, setMounted] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ganganathan_ai_chats");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const [currentSessionId, setCurrentSessionId] = useState<number>(() =>
    Date.now(),
  );
  const [messages, setMessages] = useState<Message[]>([
    { role: "bot", text: "Hello! Ready to explore my portfolio?" },
  ]);
  const [input, setInput] = useState<string>("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.fromTo(
        ".chat-bubble:last-child",
        { opacity: 0, y: 20, scale: 0.95 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.4,
          ease: "power2.out",
        },
      );
    },
    { scope: container, dependencies: [messages.length] },
  );

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const saveSessions = (updatedSessions: ChatSession[]) => {
    setSessions(updatedSessions);
    localStorage.setItem(
      "ganganathan_ai_chats",
      JSON.stringify(updatedSessions),
    );
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg: Message = { role: "user", text: input };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ prompt: input }),
      });
      const data = await res.json();
      const finalMessages: Message[] = [
        ...updatedMessages,
        { role: "bot", text: data.reply },
      ];
      setMessages(finalMessages);

      const updatedSessions = sessions.filter((s) => s.id !== currentSessionId);
      const newSession = {
        id: currentSessionId,
        title: input.slice(0, 20) + "...",
        messages: finalMessages,
      };
      saveSessions([newSession, ...updatedSessions]);
    } catch (err) {
      console.error("API Error:", err);
    }
  };

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(id);
  }, []);

  if (!mounted) return null;

  return (
    <div
      ref={container}
      className="h-dvh w-full flex bg-primary text-white overflow-hidden p-2 md:p-4"
    >
      <aside className="hidden md:flex w-72 flex-col gap-4 p-4">
        <div className="nav-island-container p-6 flex flex-col h-full rounded-3xl border border-white/10 bg-[#0a0a0c]">
          <div className="flex items-center gap-3 mb-8">
            <Image
              src={logo}
              alt="logo"
              width={40}
              height={40}
              className="object-contain"
            />
            <h1 className="text-white font-black text-lg">GANGANATHAN.DEV</h1>
          </div>
          <button
            onClick={() => {
              setCurrentSessionId(Date.now());
              setMessages([
                { role: "bot", text: "Hello! How can I help you today?" },
              ]);
            }}
            className="mb-6 w-full py-3 bg-accent hover:bg-accent/80 text-white rounded-xl transition-all font-bold"
          >
            + New Chat
          </button>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
            {sessions.map((s) => (
              <div key={s.id} className="group flex items-center gap-2">
                {editingId === s.id ? (
                  <>
                    <label htmlFor={`edit-title-${s.id}`} className="sr-only">
                      Edit chat title
                    </label>
                    <input
                      id={`edit-title-${s.id}`}
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => {
                        saveSessions(
                          sessions.map((ses) =>
                            ses.id === s.id
                              ? { ...ses, title: editTitle }
                              : ses,
                          ),
                        );
                        setEditingId(null);
                      }}
                      placeholder="Enter chat title"
                      title="Edit chat title"
                      aria-label="Edit chat title"
                      className="bg-white/10 p-2 text-sm w-full rounded-lg outline-none"
                    />
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setCurrentSessionId(s.id);
                      setMessages(s.messages);
                    }}
                    className="w-full text-left p-3 text-sm text-gray-400 hover:bg-white/5 rounded-lg truncate"
                  >
                    {s.title}
                  </button>
                )}
                <div className="hidden group-hover:flex gap-1">
                  <button
                    onClick={() => {
                      setEditingId(s.id);
                      setEditTitle(s.title);
                    }}
                    className="text-xs text-gray-500 hover:text-white"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() =>
                      saveSessions(sessions.filter((x) => x.id !== s.id))
                    }
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full nav-island-container rounded-3xl border border-white/10 bg-[#0a0a0c] overflow-hidden">
        <header className="p-6 border-b border-white/10">
          <span className="text-xs uppercase tracking-[0.2em] text-secondary font-mono">
            SYSTEM: GANGANATHAN_AI_NEURAL_LINK
          </span>
        </header>
        <section
          data-lenis-prevent
          data-lenis-prevent-touch
          ref={scrollRef}
          className="flex-1 overscroll-contain overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-accent"
        >
          {messages.map((msg, i) => (
            <div
              key={`${currentSessionId}-${i}`}
              className={`chat-bubble flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`p-4 rounded-2xl max-w-[85%] ${msg.role === "bot" ? "bg-white/5 rounded-bl-none" : "bg-accent rounded-br-none"}`}
              >
                {msg.text}
              </div>
            </div>
          ))}
        </section>
        <footer className="p-6">
          <form
            onSubmit={handleSend}
            className="bg-white/5 rounded-2xl p-4 border border-white/10 flex items-center gap-4"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..."
              className="flex-1 bg-transparent outline-none text-sm"
            />
            <button className="text-accent font-bold text-xs hover:text-white">
              SEND
            </button>
          </form>
        </footer>
      </main>
    </div>
  );
};
export default Chatbot;
