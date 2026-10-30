'use client';
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { BallCanvas } from "./canvas";
import { technologies } from "@/constants";

class CanvasErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

const Tech = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const checkScreen = () => {
      // Mobile & tablet browsers have strict WebGL context limits (usually 8-16)
      // Rendering 13 separate Three.js Canvases exhausts mobile GPU context limits.
      setIsMobile(window.innerWidth <= 768);
    };
    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  return (
    <section className="padding py-16 max-w-7xl mx-auto">
      <div className="flex flex-row flex-wrap justify-center gap-6 sm:gap-10">
        {technologies.map((technology) => {
          const fallbackOrb = (
            <div
              className="w-full h-full rounded-full bg-linear-to-b from-[#232631] to-[#100d25] border-2 border-white/10 p-3 sm:p-4 flex flex-col items-center justify-center shadow-lg hover:shadow-cyan-500/20 hover:border-cyan-400/50 transition-all duration-300 transform hover:scale-110 group select-none relative overflow-hidden"
              title={technology.name}
            >
              <div className="absolute inset-0 bg-radial from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative w-8 h-8 sm:w-12 sm:h-12 flex items-center justify-center">
                <Image
                  src={technology.icon}
                  alt={technology.name}
                  width={48}
                  height={48}
                  className="object-contain filter drop-shadow group-hover:scale-105 transition-transform"
                />
              </div>
              <span className="text-[9px] sm:text-[10px] font-mono text-gray-400 group-hover:text-cyan-300 mt-1 truncate max-w-full">
                {technology.name}
              </span>
            </div>
          );

          return (
            <div
              className="w-20 h-20 sm:w-28 sm:h-28 2xl:w-32 2xl:h-32 cursor-grab active:cursor-grabbing flex items-center justify-center"
              key={technology.name}
            >
              {mounted && !isMobile ? (
                <CanvasErrorBoundary fallback={fallbackOrb}>
                  <BallCanvas icon={technology.icon.src} />
                </CanvasErrorBoundary>
              ) : (
                fallbackOrb
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default Tech;
