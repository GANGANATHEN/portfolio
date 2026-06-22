"use client";
import React, { useRef } from "react";
import Image, { StaticImageData } from "next/image";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { projects } from "@/constants";
import git from "../../public/assets/github.png";
import ParticleBackground from "./background/ParticleBackground";

gsap.registerPlugin(ScrollTrigger);

interface Project {
  name: string;
  description?: string;
  image: StaticImageData | string;
  source_code_link: string;
  url: string;
  tags: { name: string; color: string }[];
}

const Works = () => {
  const containerRef = useRef<HTMLElement | null>(null);
  const sliderRef = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      const panels = gsap.utils.toArray<HTMLElement>(".project-card");

      const scrollTween = gsap.to(panels, {
        xPercent: -100 * (panels.length - 1),
        ease: "none",
        scrollTrigger: {
          trigger: containerRef.current,
          pin: true, // Content-a pin pannuthu
          scrub: 1,
          start: "top top",
          end: () => "+=" + (sliderRef.current?.scrollWidth ?? 0),
          invalidateOnRefresh: true,
        },
      });

      panels.forEach((panel) => {
        gsap.fromTo(
          panel,
          { scale: 0.85, rotation: 5 },
          {
            scale: 1,
            rotation: 0,
            scrollTrigger: {
              trigger: panel,
              containerAnimation: scrollTween,
              start: "left 80%",
              end: "left 20%",
              scrub: true,
            },
          },
        );
      });
    },
    { scope: containerRef },
  );

  return (
    <section
      ref={containerRef}
      className="relative h-dvh flex flex-col justify-center overflow-hidden bg-[#020205] pt-24 md:pt-18"
    >
      <ParticleBackground />

      {/* Title area */}
      <div className="px-6 md:px-20 mb-10">
        <h2 className="text-3xl sm:text-4xl md:text-6xl font-black text-white">
          Featured Work
        </h2>
      </div>

      <div
        ref={sliderRef}
        className="flex gap-6 md:gap-10 px-6 md:px-20 h-[50vh] md:h-[60vh]"
      >
        {projects.map((project: Project, index: number) => (
          // w-[85vw] for mobile, w-[40vw] for desktop - Perfect fit!
          <div
            key={index}
            className="project-card overflow-hidden shrink-0 w-[85vw] md:w-[40vw] h-full"
          >
            <div className="group relative overflow-hidden rounded-4xl bg-[#0a0a0c] border border-white/5 hover:border-cyan-500/30 transition-all duration-500 p-6 md:p-8 h-full flex flex-col justify-end">
              <Image
                src={project.image}
                alt={project.name}
                fill
                className="absolute inset-0 object-cover opacity-30 group-hover:opacity-50 transition-all duration-700"
              />
              <div className="absolute inset-0 bg-linear-to-t from-[#0a0a0c] via-[#0a0a0c]/40 to-transparent" />

              <a
                href={project.source_code_link}
                target="_blank"
                rel="noopener noreferrer"
                title={`View ${project.name} source code on GitHub`}
                aria-label={`View ${project.name} source code on GitHub`}
                className="absolute top-6 right-6 z-20 w-12 h-12 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-cyan-500 transition-colors"
              >
                <Image src={git} alt="github" width={22} height={22} />
              </a>

              <div className="relative z-10">
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  {project.name}
                </h3>
                <p className="text-gray-400 text-sm mb-6 line-clamp-3">
                  {project.description}
                </p>
                <a
                  href={project.url}
                  target="_blank"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-cyan-400"
                >
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
