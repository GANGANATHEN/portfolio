"use client";
import React, { useState, useEffect, useCallback } from "react";
import About from "@/components/About";
import MultiShapeMorph from "@/components/background/MultiShapeMorph";
import Chatbot from "@/components/Bot";
import LiveChatWidget from "@/components/LiveChat/LiveChatWidget";
import Contact from "@/components/Contact";
import Experience from "@/components/Experience";
import Hero from "@/components/Hero";
import Navbar from "@/components/Navbar";
import Tech from "@/components/Tech";
import Works from "@/components/Works";
import Commands from "@/components/Commands";

export default function Home() {
  // Coordinated mutual-exclusion state for floating chat panels
  const [activeChat, setActiveChat] = useState<"none" | "chatbot" | "livechat">("none");

  // Auto-open live chat if visited via notification email link (?live_chat=open)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("live_chat") === "open") {
        setActiveChat("livechat");
      }
    }
  }, []);

  const toggleChatbot = useCallback(() => {
    setActiveChat((prev) => (prev === "chatbot" ? "none" : "chatbot"));
  }, []);

  const toggleLiveChat = useCallback(() => {
    setActiveChat((prev) => (prev === "livechat" ? "none" : "livechat"));
  }, []);

  const closeChat = useCallback(() => {
    setActiveChat("none");
  }, []);

  return (
    <div className="relative z-0 bg-primary min-h-screen">
      {/* Nav bar */}
      <div id="main-nav" className="fixed top-0 w-full z-50">
        <Navbar />
      </div>
      {/* Hero Section */}
      <div className="w-full bg-hero-pattern bg-cover bg-no-repeat bg-center overflow-hidden">
        <Hero />
      </div>
      {/* morph animation section */}
      <MultiShapeMorph>
        <About />
        <Experience />
        <Tech />
      </MultiShapeMorph>
      <Works />
      <Commands />
      {/* AI Assistant Chatbot */}
      <Chatbot
        isOpen={activeChat === "chatbot"}
        onToggle={toggleChatbot}
        onClose={closeChat}
      />
      {/* Direct Live Visitor Chat System */}
      <LiveChatWidget
        isOpen={activeChat === "livechat"}
        onToggle={toggleLiveChat}
        onClose={closeChat}
      />
      <Contact />
    </div>
  );
}
