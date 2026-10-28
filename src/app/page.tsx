"use client";
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
import Feedbacks from "@/components/Feedbacks";

export default function Home() {
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
      <Feedbacks />
      {/* AI Assistant Chatbot */}
      <Chatbot />
      {/* Direct Live Visitor Chat System */}
      <LiveChatWidget />
      <Contact />
    </div>
  );
}
