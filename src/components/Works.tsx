"use client";
import React, { useRef } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { projects } from "@/constants";
import git from "../../public/assets/github.png";
import ParticleBackground from "./background/ParticleBackground";

gsap.registerPlugin(ScrollTrigger);

const Works = () => {
  const containerRef = useRef(null);
  const sliderRef = useRef(null);

  useGSAP(() => {
    const panels = gsap.utils.toArray(".project-card");
    
    // Horizontal Scroll Animation
    const scrollTween = gsap.to(panels, {
      xPercent: -100 * (panels.length - 1),
      ease: "none",
      scrollTrigger: {
        trigger: sliderRef.current,
        pin: true,
        scrub: 1,
        end: () => "+=" + sliderRef.current.offsetWidth,
      }
    });

    // Advanced Interaction: Tilt & Scale effect during scroll
    panels.forEach((panel, i) => {
      gsap.fromTo(panel, 
        { scale: 0.8, rotation: 10 }, 
        { 
          scale: 1, rotation: 0, 
          scrollTrigger: {
            trigger: panel,
            containerAnimation: scrollTween,
            start: "left 80%",
            end: "left 20%",
            scrub: true
          }
        }
      );
    });
  }, { scope: containerRef });

  return (
    // 'pt-32' to give space for the Header
    <section ref={containerRef} className="relative pt-32 pb-24 overflow-hidden ">
      <ParticleBackground />
      
      <div className="px-6 md:px-20 mb-16">
        <h2 className="text-6xl font-black text-white">Featured Work</h2>
      </div>

      {/* Horizontal Slider Container */}
      <div ref={sliderRef} className="flex gap-8 px-6 md:px-20">
        {projects.map((project, index) => (
          <div key={index} className="project-card flex-shrink-0 w-[350px] md:w-[450px]">
            {/* Added a bit of perspective to the card container */}
            <div className="group relative overflow-hidden rounded-[2rem] bg-[#0a0a0c] border border-white/5 hover:border-cyan-500/30 transition-all duration-500 p-8 h-[500px] flex flex-col justify-end">
              <Image src={project.image} alt={project.name} fill className="absolute inset-0 object-cover opacity-30 group-hover:opacity-50 transition-all duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/40 to-transparent" />

              <a href={project.source_code_link} target="_blank" rel="noopener noreferrer" className="absolute top-8 right-8 z-20 w-12 h-12 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-cyan-500 transition-colors">
                <Image src={git} alt="github" width={24} height={24} />
              </a>

              <div className="relative z-10">
                <h3 className="text-3xl font-bold text-white mb-2">{project.name}</h3>
                <p className="text-gray-400 text-sm mb-6 max-w-[80%]">{project.description}</p>
                <a href={project.url} target="_blank" className="inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-cyan-400">
                  View Project →
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Works;