"use client";
import { useRef, useState, useEffect } from "react";
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
  const [isMounted, setIsMounted] = useState(false);
  const name = "Ganganathan";

  useGSAP(
    () => {
      if (isMounted) {
        popIn(".hero-dot", 0.2);
        drawLineVertical(".hero-line", 0.5);

        revealText(".hero-text", 0.8);

        revealChars(".hero-char", 1.2);

        floatAnimation(".scroll-indicator");
      }
    },
    { scope: container, dependencies: [isMounted] },
  );

  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      setIsMounted(true);
    });
    return () => cancelAnimationFrame(rafId);
  }, []);

  if (!isMounted) return null;

  return (
    <section
      ref={container}
      className="relative w-full h-dvh padding overflow-hidden"
    >
      <div className="relative mt-20 flex flex-row items-start gap-5 z-10 pointer-events-none">
        {/* Graphics part */}
        <div className="flex flex-col justify-center items-center mt-5">
          <div className="hero-dot w-5 h-5 rounded-full bg-accent" />
          <div className="hero-line w-1 sm:h-80 h-40 bg-linear-to-b from-accent to-transparent" />
        </div>

        {/* Text content part */}
        <div>
          <div className="overflow-hidden py-1 2xl:mt-4">
            <h1 className="hero-text text-white font-black 2xl:text-[90px] lg:text-[70px] sm:text-[50px] text-[40px] max-[375px]:text-[30px] mt-2 leading-snug">
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
            <p className="hero-text text-white font-medium lg:text-[30px] sm:text-[26px] text-[20px] max-[375px]:text-[16px]">
              I build end-to-end web experiences,
              <br className="sm:block hidden" />
              crafting intuitive interfaces and scalable applications.
            </p>
          </div>
        </div>
      </div>

      <div
        className="absolute top-0 inset-0  z-0 cursor-grab active:cursor-grabbing 
        lg:[@media(min-height:700px)]:-top-30 
        lg:[@media(min-height:750px)]:-top-50 lg:[@media(min-height:800px)]:-top-70 
        lg:[@media(min-height:900px)]:-top-90
       "
      >
        <ComputersCanvas />
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 bottom-0 flex justify-center items-center z-20 pointer-events-none">
        <a
          href="#about"
          className="pointer-events-auto"
          title="About section"
          aria-label="About section"
        >
          <div className="w-6 h-12 sm:w-7 sm:h-14 md:w-8 md:h-16 2xl:w-8.75 2xl:h-16 rounded-3xl border-[3px] sm:border-4 border-secondary flex justify-center items-start p-1 md:p-1.5 2xl:p-2 opacity-80 hover:opacity-100 transition-opacity cursor-pointer">
            <div
              className="scroll-indicator w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 rounded-full bg-secondary mb-1"
              aria-hidden="true"
            />
          </div>
        </a>
      </div>
    </section>
  );
};

export default Hero;
