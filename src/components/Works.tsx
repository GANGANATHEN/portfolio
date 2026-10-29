"use client";
import React, { useRef, useState, useEffect } from "react";
import Image, { StaticImageData } from "next/image";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { projects } from "@/constants";
import git from "../../public/assets/github.png";
import ParticleBackground from "./background/ParticleBackground";
import { X, Lock, ExternalLink, AlertCircle, ArrowUpRight, FolderGit2 } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

interface Project {
  name: string;
  description?: string;
  image: StaticImageData | string;
  source_code_link: string | null;
  url: string | null;
  tags: { name: string; color: string }[];
}

interface ProjectInfoModal {
  title: string;
  message: string;
  projectName: string;
  isPrivateRepo: boolean;
}

export default function Works() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [infoModal, setInfoModal] = useState<ProjectInfoModal | null>(null);

  // Close modal on Escape key
  useEffect(() => {
    if (!infoModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setInfoModal(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [infoModal]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!infoModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [infoModal]);

  // Subtle staggered reveal animation for project cards with reduced-motion support
  useGSAP(
    () => {
      if (typeof window === "undefined") return;

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      if (prefersReducedMotion) return;

      const cards = gsap.utils.toArray<HTMLElement>(".work-project-card");
      cards.forEach((card) => {
        gsap.fromTo(
          card,
          { opacity: 0, y: 35 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: "power2.out",
            scrollTrigger: {
              trigger: card,
              start: "top 88%",
              toggleActions: "play none none none",
              once: true,
            },
          }
        );
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      id="work"
      ref={sectionRef}
      className="relative min-h-screen py-20 sm:py-28 px-4 sm:px-6 md:px-12 lg:px-20 bg-[#020205] overflow-visible"
    >
      <ParticleBackground />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section Header */}
        <div className="mb-12 sm:mb-16">
          <p className="text-cyan-400 text-xs uppercase tracking-wider font-mono font-semibold">
            PORTFOLIO SHOWCASE
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight mt-1.5">
            Featured <span className="text-cyan-400">Projects</span>
          </h2>
          <p className="text-gray-400 text-sm sm:text-base mt-3 max-w-2xl leading-relaxed">
            A curated collection of full-stack web applications, real-time messaging platforms,
            desktop utilities, and interactive 3D experiences.
          </p>
        </div>

        {/* Responsive Natural Document Grid (No horizontal pinning, no scroll lock) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {projects.map((project: Project, index: number) => {
            const hasSourceCode = Boolean(
              project.source_code_link && project.source_code_link.trim()
            );
            const hasLiveDemo = Boolean(project.url && project.url.trim());

            return (
              <article
                key={project.name || index}
                className="work-project-card group rounded-3xl bg-[#0a0a0c] border border-white/10 hover:border-cyan-500/30 transition-all duration-300 p-5 sm:p-6 flex flex-col justify-between shadow-xl hover:shadow-cyan-500/5 relative overflow-hidden"
              >
                <div>
                  {/* Project Image Container with Consistent Aspect Ratio */}
                  <div className="relative h-48 sm:h-56 w-full overflow-hidden rounded-2xl bg-black/60 border border-white/5 mb-5">
                    <Image
                      src={project.image}
                      alt={project.name}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover opacity-85 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-[#0a0a0c] via-transparent to-transparent opacity-60" />

                    {/* Source Code Action Button (Top Right of Image) */}
                    <div className="absolute top-3 right-3 z-20">
                      {hasSourceCode ? (
                        <a
                          href={project.source_code_link!}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`View ${project.name} source code on GitHub`}
                          aria-label={`View ${project.name} source code on GitHub`}
                          className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/15 hover:bg-cyan-500 hover:border-cyan-400 transition-all cursor-pointer shadow-lg group/btn"
                        >
                          <Image
                            src={git}
                            alt="GitHub"
                            width={18}
                            height={18}
                            className="group-hover/btn:brightness-0 group-hover/btn:invert transition-all"
                          />
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setInfoModal({
                              title: "Private Repository",
                              message:
                                "This project uses a private or proprietary codebase. Source code access is restricted.",
                              projectName: project.name,
                              isPrivateRepo: true,
                            })
                          }
                          title="Source code is in a private repository"
                          aria-label={`Source code for ${project.name} is private`}
                          className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/15 hover:border-cyan-500/50 hover:bg-white/10 transition-colors cursor-pointer group/btn"
                        >
                          <Image
                            src={git}
                            alt="GitHub"
                            width={18}
                            height={18}
                            className="opacity-70 group-hover/btn:opacity-100"
                          />
                          <Lock className="w-2.5 h-2.5 text-cyan-400 absolute bottom-2 right-2 drop-shadow" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Project Details */}
                  <h3 className="text-xl sm:text-2xl font-bold text-white group-hover:text-cyan-300 transition-colors mb-2">
                    {project.name}
                  </h3>

                  <p className="text-gray-400 text-xs sm:text-sm line-clamp-3 leading-relaxed mb-4">
                    {project.description}
                  </p>

                  {/* Technology Tags */}
                  {project.tags && project.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {project.tags.map((tag) => (
                        <span
                          key={tag.name}
                          className="text-[10px] sm:text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-white/5 text-cyan-300 border border-white/5"
                        >
                          #{tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Footer: Live Demo Action Link / Unavailable Modal */}
                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                  {hasLiveDemo ? (
                    <a
                      href={project.url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer group/link"
                    >
                      <span>Live Deployment</span>
                      <ArrowUpRight className="w-4 h-4 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setInfoModal({
                          title: "Deployment Unavailable",
                          message:
                            "This application is currently not publicly deployed or hosted. A live demo is unavailable at this time.",
                          projectName: project.name,
                          isPrivateRepo: false,
                        })
                      }
                      className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-gray-500 hover:text-amber-400 transition-colors cursor-pointer"
                    >
                      <span>Demo Unavailable</span>
                      <AlertCircle className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  )}

                  <span className="text-[11px] font-mono text-gray-600">
                    0{index + 1}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* Accessible Information Modal for Private Repo or Unavailable Deployment */}
      {infoModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-info-modal-title"
          className="fixed inset-0 z-70 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setInfoModal(null)}
        >
          <div
            className="w-full max-w-md bg-[#0c1017] border border-white/15 rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col gap-4 text-white relative animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setInfoModal(null)}
              aria-label="Close dialog"
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Icon + Title */}
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  infoModal.isPrivateRepo
                    ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                    : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                }`}
              >
                {infoModal.isPrivateRepo ? (
                  <Lock className="w-6 h-6" />
                ) : (
                  <AlertCircle className="w-6 h-6" />
                )}
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400 block">
                  {infoModal.projectName}
                </span>
                <h3
                  id="project-info-modal-title"
                  className="text-lg font-bold text-white"
                >
                  {infoModal.title}
                </h3>
              </div>
            </div>

            {/* Body */}
            <p className="text-sm text-gray-300 leading-relaxed font-sans">
              {infoModal.message}
            </p>

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-2 border-t border-white/10 mt-1">
              <button
                type="button"
                onClick={() => setInfoModal(null)}
                className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs transition-colors cursor-pointer font-mono"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
