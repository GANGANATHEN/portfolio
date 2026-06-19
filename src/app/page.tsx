"use client";
import { useEffect, useState } from "react";
// import gsap from "gsap";
// import { ScrollTrigger } from "gsap/ScrollTrigger";
import About from "@/components/About";
import MultiShapeMorph from "@/components/background/MultiShapeMorph";
import Chatbot from "@/components/Bot";
import Contact from "@/components/Contact";
import Experience from "@/components/Experience";
import Hero from "@/components/Hero";
import Navbar from "@/components/Navbar";
import Tech from "@/components/Tech";
import Works from "@/components/Works";
import Feedbacks from "@/components/Feedbacks";

export default function Home() {
  // useEffect(() => {
  //   gsap.registerPlugin(ScrollTrigger);

  //   ScrollTrigger.create({
  //     trigger: "#chatbot-section",
  //     start: "top 80%",
  //     end: "top 80%",
  //     onEnter: () =>
  //       gsap.to("#main-nav", { y: -100, opacity: 0, duration: 0.5 }),
  //     onLeave: () => gsap.to("#main-nav", { y: 0, opacity: 1, duration: 0.5 }),
  //     onEnterBack: () =>
  //       gsap.to("#main-nav", { y: -100, opacity: 0, duration: 0.5 }),
  //     onLeaveBack: () =>
  //       gsap.to("#main-nav", { y: 0, opacity: 1, duration: 0.5 }),
  //   });
  // }, []);

  const [extraHeight, setExtraHeight] = useState(0);

  useEffect(() => {
    const update = () => {
      if (window.innerWidth < 1024) {
        setExtraHeight(window.innerHeight * 0.32);
      } else {
        setExtraHeight(0);
      }
    };

    update();
    window.addEventListener("resize", update);
    console.log(extraHeight);

    return () => window.removeEventListener("resize", update);
  }, [extraHeight]);

  return (
    <div className="relative z-0 bg-primary">
      <div id="main-nav" className="fixed top-0 w-full z-50">
        <Navbar />
      </div>
      {/* Hero Section */}
      <div className="w-full bg-hero-pattern bg-cover bg-no-repeat bg-center overflow-hidden">
        <Hero />
      </div>
      {/* other section */}
      <MultiShapeMorph>
        <About />
        <Experience />
        <Tech />
      </MultiShapeMorph>
      <Works />
      <Feedbacks />
      <Chatbot />
      <div id="chatbot-section">
        <Contact />
      </div>
      <div className="h-dvh border-2 border-red-600">demo</div>
      {/* <div className="h-dvh border-2 border-red-600">demo</div>
      <div className="h-dvh border-2 border-red-600">demo</div>
      <div className="h-dvh border-2 border-red-600">demo</div>
      <div className="h-dvh border-2 border-red-600">demo</div> */}
      {/* <div
        className="extr-space border-2 border-red-600"
        style={{ height: extraHeight }}
      ></div> */}
    </div>
  );
}
