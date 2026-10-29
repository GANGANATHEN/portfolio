"use client";
import React, { useRef, useState, useEffect } from "react";
import Image, { StaticImageData } from "next/image";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { projects } from "@/constants";
import git from "../../public/assets/github.png";
import ParticleBackground from "./background/ParticleBackground";
import { X, Lock, ExternalLink, AlertCircle } from "lucide-react";

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

const Works = () => {
  const containerRef = useRef<HTMLElement | null>(null);
  const sliderRef = useRef<HTMLDivElement | null>(null);
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
        {projects.map((project: Project, index: number) => {
          const hasSourceCode = Boolean(project.source_code_link && project.source_code_link.trim());
          const hasLiveDemo = Boolean(project.url && project.url.trim());

          return (
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

                {/* Source Code Action Button */}
                {hasSourceCode ? (
                  <a
                    href={project.source_code_link!}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`View ${project.name} source code on GitHub`}
                    aria-label={`View ${project.name} source code on GitHub`}
                    className="absolute top-6 right-6 z-20 w-12 h-12 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-cyan-500 transition-colors cursor-pointer"
                  >
                    <Image src={git} alt="github" width={22} height={22} />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setInfoModal({
                        title: "Private Repository",
                        message:
                          "This project uses a private repository. Source code access is not available publicly.",
                        projectName: project.name,
                        isPrivateRepo: true,
                      })
                    }
                    title="Source code is in a private repository"
                    aria-label={`Source code for ${project.name} is private`}
                    className="absolute top-6 right-6 z-20 w-12 h-12 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 hover:border-cyan-500/50 hover:bg-white/10 transition-colors cursor-pointer group/btn"
                  >
                    <Image
                      src={git}
                      alt="github"
                      width={22}
                      height={22}
                      className="opacity-70 group-hover/btn:opacity-100"
                    />
                    <Lock className="w-3 h-3 text-cyan-400 absolute bottom-2 right-2 drop-shadow" />
                  </button>
                )}

                <div className="relative z-10">
                  <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
                    {project.name}
                  </h3>
                  <p className="text-gray-300 text-xs sm:text-sm mb-4 line-clamp-2 sm:line-clamp-3">
                    {project.description}
                  </p>

                  {/* Tech Badges */}
                  {project.tags && project.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {project.tags.map((tag) => (
                        <span
                          key={tag.name}
                          className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-cyan-300 border border-white/5"
                        >
                          #{tag.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Project URL / Deployment Action Button */}
                  {hasLiveDemo ? (
                    <a
                      href={project.url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-cyan-400 transition-colors cursor-pointer"
                    >
                      <span>View Project →</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setInfoModal({
                          title: "Deployment Unavailable",
                          message:
                            "This project is not deployed yet. A live demo is currently unavailable.",
                          projectName: project.name,
                          isPrivateRepo: false,
                        })
                      }
                      className="inline-flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-cyan-300 transition-colors cursor-pointer"
                    >
                      <span>Demo Unavailable</span>
                      <AlertCircle className="w-4 h-4 opacity-70" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Information Dialog / Modal for Private Repo or Unavailable Deployment */}
      {infoModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-info-modal-title"
          className="fixed inset-0 z-70 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setInfoModal(null)}
        >
          <div
            className="w-full max-w-md bg-[#0e1621] border border-white/15 rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col gap-4 text-white relative animate-in zoom-in-95 duration-150"
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
                className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs transition-colors cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Works;
