"use client";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ComputersCanvas } from "./canvas";

const Hero = () => {
  const container = useRef(null);

  useGSAP(
    () => {
      // Text animation
      gsap.from(".hero-text", {
        opacity: 0,
        y: 50,
        duration: 1.2,
        stagger: 0.2,
        ease: "power4.out",
      });

      gsap.to(".scroll-indicator", {
        y: 24,
        duration: 1.5,
        repeat: -1,
        yoyo: true,
        ease: "power1.inOut",
      });
    },
    { scope: container },
  );

  return (
    <section ref={container} className="relative w-full h-screen padding">
      <div className="hero-text absolute inset-0 top-[120px] max-w-7xl px-6 sm:px-16 flex flex-row items-start gap-5">
        <div className="flex flex-col justify-center items-center mt-5">
          <div className="w-5 h-5 rounded-full bg-accent" />
          <div className="w-1 sm:h-80 h-40 bg-gradient-to-b from-accent to-transparent" />
        </div>

        <div>
          <h1 className="text-white font-black lg:text-[80px] sm:text-[60px] text-[40px] mt-2">
            Hi, I&apos;m <span className="text-accent">G</span>
          </h1>
          <p className="text-[#dfd9ff] font-medium lg:text-[30px] sm:text-[26px] mt-2">
            I&apos;m a developer, I develop user{" "}
            <br className="sm:block hidden" />
            interfaces and web applications
          </p>
        </div>
      </div>

      <ComputersCanvas />

      {/* GSAP Scroll Indicator */}
      <div className="absolute left-1/2 -translate-x-1/2 xs:bottom-10 bottom-10 flex justify-center items-center pointer-events-none">
        <a href="#about" className="pointer-events-auto">
          <div className="w-[35px] h-[64px] rounded-3xl border-4 border-secondary flex justify-center items-start p-2">
            <div className="scroll-indicator w-3 h-3 rounded-full bg-secondary mb-1" />
          </div>
        </a>
      </div>
    </section>
  );
};

export default Hero;
