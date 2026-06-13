"use client";
import About from "@/components/About";
import MultiShapeMorph from "@/components/background/MultiShapeMorph";
import Contact from "@/components/Contact";
import Experience from "@/components/Experience";
import Feedbacks from "@/components/Feedbacks";
import Hero from "@/components/Hero";
import Navbar from "@/components/Navbar";
import Tech from "@/components/Tech";
import Works from "@/components/Works";

export default function Home() {
  return (
    <div className="relative z-0 bg-primary">
      {/* Hero Section */}
      <div className="h-screen w-full bg-hero-pattern bg-cover bg-no-repeat bg-center overflow-hidden">
        <Navbar />
        <Hero />
      </div>
      <MultiShapeMorph>
        <About />
        <Experience />
        <Tech />
      </MultiShapeMorph>
      <Works />
      <Feedbacks />
      <Contact />
    </div>
  );
}
