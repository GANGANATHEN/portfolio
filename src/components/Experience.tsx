"use client";
import React, { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { experiences } from "@/constants";

gsap.registerPlugin(ScrollTrigger);

const Education = () => {
  const containerRef = useRef(null);

  useGSAP(
    () => {
      // 1. Line Growth Timeline (Syncing Both Lines)
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 60%",
          end: "+=2200",
          scrub: 1.5,
        },
      });

      // Animate Gray Track (Fade In) and Glow Line (Height Expand)
      tl.fromTo(
        ".bg-track",
        { opacity: 0 },
        { opacity: 1, duration: 0.5 },
      ).fromTo(
        ".energy-glow",
        { height: "0%" },
        { height: "100%", ease: "none" },
        0, // Parallel-ah start aagum
      );

      // 2. Connector and Card stagger animation
      gsap.fromTo(
        ".data-panel",
        { opacity: 0, x: (i) => (i % 2 === 0 ? -50 : 50) },
        {
          opacity: 1,
          x: 0,
          duration: 1,
          stagger: 0.4,
          ease: "power2.out",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 50%",
            end: "+=2000",
            scrub: 1.5,
          },
        },
      );
    },
    { scope: containerRef },
  );

  return (
    <section
      ref={containerRef}
      className="edu-section py-20 text-white relative overflow-hidden"
    >
      <h2 className="text-center text-5xl font-black mb-20 uppercase tracking-tighter text-transparent bg-clip-text bg-linear-to-r from-cyan-400 to-purple-500">
        Educations.
      </h2>

      <div className="relative max-w-5xl mx-auto flex flex-col items-center">
        <div className="bg-track absolute top-0 w-0.5 bg-cyan-900/30 h-full hidden lg:block" />

        {/* Glow Stream (Already has 'energy-glow' class) */}
        <div className="absolute top-0 w-0.5 h-full hidden lg:block overflow-hidden">
          <div className="energy-glow w-full bg-linear-to-b from-cyan-400 to-purple-500 shadow-[0_0_20px_#22d3ee] origin-top" />
        </div>

        <div className="w-full flex flex-col gap-24 px-6 lg:px-0">
          {experiences.map((exp, i) => (
            <div
              key={i}
              className={`data-panel relative flex items-center w-full ${i % 2 === 0 ? "lg:justify-start" : "lg:justify-end"}`}
            >
              {/* Connector */}
              {/* <div
                className="hidden lg:block absolute w-20 h-px bg-cyan-500/50"
                style={{
                  left: i % 2 === 0 ? "calc(50% + 1px)" : "auto",
                  right: i % 2 !== 0 ? "calc(50% + 1px)" : "auto",
                }}
              /> */}

              <div
                className={`hidden lg:block absolute w-20 h-px bg-cyan-500/50 
                ${i % 2 === 0 ? "left-[calc(50%+1px)]" : "right-[calc(50%+1px)]"}
                `}
              />

              {/* Neon Card */}
              <div className="w-full lg:w-[45%] p-px bg-linear-to-r from-cyan-500/50 to-purple-500/50 rounded-sm">
                <div className="p-6 bg-[#0b0b15] border-l-4 border-cyan-500 backdrop-blur-md">
                  <div className="text-cyan-400 font-mono text-[10px] uppercase tracking-widest mb-2">
                    Milestone 0{i + 1}
                  </div>
                  <h3 className="text-xl font-bold">{exp.title}</h3>
                  <p className="text-gray-400 text-sm mt-1">
                    {exp.company_name}
                  </p>
                  <div className="mt-4 pt-4 border-t border-white/10 flex justify-between font-mono text-[11px] text-purple-300">
                    <span>{exp.date}</span>
                    <span>9.1 CGPA</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Education;
