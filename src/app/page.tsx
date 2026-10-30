"use client";
import React, { useState, useEffect } from "react";
import About from "@/components/About";
import MultiShapeMorph from "@/components/background/MultiShapeMorph";
import UnifiedChatModal from "@/components/UnifiedChat/UnifiedChatModal";
import Contact from "@/components/Contact";
import Experience from "@/components/Experience";
import Hero from "@/components/Hero";
import Navbar from "@/components/Navbar";
import Tech from "@/components/Tech";
import Works from "@/components/Works";
import Commands from "@/components/Commands";

export default function Home() {
  const [initialTab, setInitialTab] = useState<"chatbot" | "livechat">("chatbot");

  // Auto-switch to live chat tab if visited via notification email link (?live_chat=open)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("live_chat") === "open") {
        setInitialTab("livechat");
      }
    }
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
      {/* Unified Floating Chat Window: AI Assistant & Direct Live Chat */}
      <UnifiedChatModal initialTab={initialTab} />
      <Contact />
    </div>
  );
}
