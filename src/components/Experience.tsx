'use client';
import React, { useRef } from "react";
import Image from "next/image";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { experiences } from "@/constants";

gsap.registerPlugin(ScrollTrigger);

const Experience = () => {
  const containerRef = useRef(null);

  useGSAP(() => {
    // Timeline line growth animation
    gsap.fromTo(".timeline-line", 
      { height: 0 }, 
      { 
        height: "100%", 
        scrollTrigger: {
          trigger: ".timeline-container",
          start: "top 80%",
          end: "bottom 20%",
          scrub: 1
        }
      }
    );

    // Cards fade in animation
    gsap.from(".exp-card", {
      opacity: 0,
      y: 50,
      stagger: 0.3,
      scrollTrigger: {
        trigger: ".timeline-container",
        start: "top 70%"
      }
    });
  }, { scope: containerRef });

  return (
    <section id="work" ref={containerRef} className="max-w-7xl mx-auto px-6 sm:px-16 py-16">
      <h2 className="text-white font-black text-center text-[40px] mb-20">Educations.</h2>

      <div className="timeline-container relative flex flex-col items-center">
        {/* The Vertical Line */}
        <div className="absolute w-1 bg-secondary h-full left-1/2 -ml-0.5">
          <div className="timeline-line w-full bg-accent origin-top" />
        </div>

        {/* Timeline Items */}
        {experiences.map((exp, index) => (
          <div key={index} className={`exp-card mb-12 w-full flex justify-center items-center ${index % 2 === 0 ? "flex-row-reverse" : "flex-row"}`}>
            <div className="w-1/2 px-8 text-right">
              <h3 className="text-white font-bold text-[20px]">{exp.title}</h3>
              <p className="text-secondary">{exp.company_name}</p>
              <span className="text-accent">{exp.date}</span>
            </div>
            
            <div className="w-10 h-10 rounded-full bg-tertiary border-4 border-accent flex justify-center items-center z-10">
              <Image src={exp.icon} alt="icon" width={20} height={20} />
            </div>

            <div className="w-1/2" /> {/* Empty spacer */}
          </div>
        ))}
      </div>
    </section>
  );
};

export default Experience;