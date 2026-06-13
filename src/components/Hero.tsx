"use client";
import React, { useRef } from "react";
import { useGSAP } from "@gsap/react";
import {
  revealText,
  popIn,
  drawLineVertical,
  floatAnimation,
  revealChars,
} from "@/utils/animations";
import { ComputersCanvas } from "./canvas";

const Hero = () => {
  const container = useRef<HTMLElement>(null);
  const name = "demo";

  useGSAP(
    () => {
      popIn(".hero-dot", 0.2);
      drawLineVertical(".hero-line", 0.5);

      revealText(".hero-text", 0.8);

      revealChars(".hero-char", 1.2);

      floatAnimation(".scroll-indicator");
    },
    { scope: container },
  );

  return (
    <section
      ref={container}
      className="relative w-full h-screen padding overflow-hidden"
    >
      <div className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing">
        <ComputersCanvas />
      </div>

      <div className="absolute inset-0 top-30 max-w-7xl px-6 sm:px-16 flex flex-row items-start gap-5 z-10 pointer-events-none">
        {/* Graphics part */}
        <div className="flex flex-col justify-center items-center mt-5">
          <div className="hero-dot w-5 h-5 rounded-full bg-accent" />
          <div className="hero-line w-1 sm:h-80 h-40 bg-linear-to-b from-accent to-transparent" />
        </div>

        {/* Text content part */}
        <div>
          <div className="overflow-hidden py-1">
            <h1 className="hero-text text-white font-black lg:text-[80px] sm:text-[60px] text-[40px] mt-2">
              Hi, I&apos;m{" "}
              <span
                className="text-orange-300 whitespace-nowrap"
                aria-label={name}
              >
                {name.split("").map((char, index) => (
                  <span
                    key={index}
                    className="hero-char inline-block"
                    aria-hidden="true"
                  >
                    {char === " " ? "\u00A0" : char}
                  </span>
                ))}
              </span>
            </h1>
          </div>

          <div className="overflow-hidden py-1 mt-2">
            <p className="hero-text text-[#dfd9ff] font-medium lg:text-[30px] sm:text-[26px]">
              I build end-to-end web experiences,
              <br className="sm:block hidden" />
              crafting intuitive interfaces and scalable applications.
            </p>
          </div>
        </div>
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 bottom-0 flex justify-center items-center z-20 pointer-events-none">
        <a href="#about" className="pointer-events-auto" title="About section" aria-label="About section">
          <div className="w-8.75 h-16 rounded-3xl border-4 border-secondary flex justify-center items-start p-2 opacity-80 hover:opacity-100 transition-opacity cursor-pointer">
            <div className="scroll-indicator w-3 h-3 rounded-full bg-secondary mb-1" aria-hidden="true" />
          </div>
        </a>
      </div>
    </section>
  );
};

export default Hero;
