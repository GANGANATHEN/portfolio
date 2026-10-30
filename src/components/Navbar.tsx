"use client";
import React, { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Play, Pause, Compass, X, Volume2, VolumeX } from "lucide-react";
import { navLinks } from "@/constants";
import { logo } from "../../public/assets";
import GlassSurface from "./GlassSurface";

// Web Audio Ambient Synthesizer Singleton to ensure single audio player across the application
class AmbientAudioController {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private isInitialized = false;

  public init() {
    if (this.isInitialized || typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      // Master gain node with gentle limiter
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);

      // Lowpass filter for smooth ambient tone
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(420, this.ctx.currentTime);
      filter.Q.setValueAtTime(1.5, this.ctx.currentTime);

      // Ethereal chord frequencies (Cmaj9 / Fmaj7 ambient voicing)
      const frequencies = [130.81, 196.0, 246.94, 329.63, 392.0];

      frequencies.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();

        // Subtle detuning and sine/triangle mix
        osc.type = idx % 2 === 0 ? "sine" : "triangle";
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        osc.detune.setValueAtTime((idx - 2) * 4, this.ctx.currentTime);

        // Lower volume for individual harmonic layers
        oscGain.gain.setValueAtTime(0.04 / (idx + 1), this.ctx.currentTime);

        osc.connect(oscGain);
        oscGain.connect(filter);
        osc.start();
        this.oscillators.push(osc);
      });

      filter.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.isInitialized = true;
    } catch (e) {
      console.warn("Ambient audio initialization failed:", e);
    }
  }

  public play(): boolean {
    this.init();
    if (!this.ctx || !this.masterGain) return false;
    try {
      if (this.ctx.state === "suspended") {
        this.ctx.resume();
      }
      // Gentle fade in
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.setTargetAtTime(0.12, this.ctx.currentTime, 0.4);
      return true;
    } catch {
      return false;
    }
  }

  public pause() {
    if (!this.ctx || !this.masterGain) return;
    try {
      // Gentle fade out
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
      setTimeout(() => {
        if (this.ctx && this.ctx.state === "running") {
          this.ctx.suspend().catch(() => {});
        }
      }, 400);
    } catch {}
  }

  public destroy() {
    this.oscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
    });
    this.oscillators = [];
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch {}
      this.ctx = null;
    }
    this.isInitialized = false;
  }
}

const ambientAudio = new AmbientAudioController();

const Navbar = () => {
  const [active, setActive] = useState("Home");
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const sidePanelRef = useRef<HTMLDivElement | null>(null);

  // Active section tracking on window scroll
  useEffect(() => {
    const sectionIds = navLinks.map((l) => l.id);
    const handleScroll = () => {
      const scrollY = window.scrollY;
      if (scrollY < 120) {
        setActive("Home");
        return;
      }
      for (let i = sectionIds.length - 1; i >= 0; i--) {
        const id = sectionIds[i];
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 200) {
            const currentNav = navLinks.find((l) => l.id === id);
            if (currentNav) setActive(currentNav.title);
            break;
          }
        }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Keyboard navigation: Escape key closes the navigation panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isNavOpen) {
        setIsNavOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isNavOpen]);

  // Close panel on outside click
  useEffect(() => {
    if (!isNavOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (sidePanelRef.current && !sidePanelRef.current.contains(e.target as Node)) {
        setIsNavOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isNavOpen]);

  // Audio play/pause toggle
  const toggleMusic = useCallback(() => {
    if (isPlayingMusic) {
      ambientAudio.pause();
      setIsPlayingMusic(false);
    } else {
      const ok = ambientAudio.play();
      if (ok) setIsPlayingMusic(true);
    }
  }, [isPlayingMusic]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      ambientAudio.pause();
    };
  }, []);

  // Smooth Section Navigation
  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string, title: string) => {
    e.preventDefault();
    setActive(title);
    setIsNavOpen(false);

    if (id === "home") {
      if (typeof window !== "undefined") {
        const globalLenis = (window as unknown as { __lenis?: { scrollTo: (target: number | HTMLElement, opts?: unknown) => void } }).__lenis;
        if (globalLenis) {
          globalLenis.scrollTo(0);
        } else {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        window.history.pushState(null, "", "/");
      }
      return;
    }

    const target = document.getElementById(id);
    if (target) {
      const globalLenis = (window as unknown as { __lenis?: { scrollTo: (target: number | HTMLElement, opts?: unknown) => void } }).__lenis;
      if (globalLenis) {
        globalLenis.scrollTo(target, { offset: -90 });
      } else {
        const navHeight = 90;
        const elementPosition = target.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - navHeight;
        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth",
        });
      }
      window.history.pushState(null, "", `#${id}`);
    }
  };

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. TOP HEADER: Portfolio Brand on Far Left, Music ON/OFF on Far Right    */}
      {/* Clean, simple layout with NO glassmorphism, blur, or SVG refraction       */}
      {/* ========================================================================= */}
      <header className="fixed top-0 left-0 right-0 z-40 px-4 sm:px-8 py-3 sm:py-4 pointer-events-none select-none">
        <div className="w-full flex items-center justify-between pointer-events-auto">
          {/* Portfolio Brand Logo & Name (Far Left) */}
          <Link
            href="/"
            onClick={(e) => handleNavClick(e, "home", "Home")}
            className="flex items-center gap-2.5 sm:gap-3 group cursor-pointer focus:outline-none"
            aria-label="Ganganathan Portfolio Home"
          >
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-black/40 p-1.5 border border-white/10 group-hover:border-cyan-400/50 transition-colors shadow-sm">
              <Image
                src={logo}
                alt="Ganganathan Logo"
                width={36}
                height={36}
                className="object-contain w-full h-full"
                priority
              />
            </div>
            <div className="flex flex-col">
              <p className="text-white text-[15px] sm:text-[17px] font-extrabold tracking-wider flex items-center drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
                GANGANATHAN
                <span className="text-cyan-400 ml-1.5 text-xs font-mono font-bold tracking-widest">
                  .DEV
                </span>
              </p>
              <span className="hidden sm:block text-[10px] text-gray-400 font-mono tracking-tight -mt-0.5">
                Full-Stack & 3D Interactive
              </span>
            </div>
          </Link>

          {/* Music Play / Pause Control (Far Right) */}
          <div className="flex items-center">
            <button
              type="button"
              onClick={toggleMusic}
              aria-label={isPlayingMusic ? "Pause ambient sound" : "Play ambient sound"}
              title={isPlayingMusic ? "Pause ambient audio" : "Play ambient audio"}
              className={`group flex items-center gap-2 sm:gap-2.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full border transition-all duration-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
                isPlayingMusic
                  ? "bg-cyan-500/20 border-cyan-400/60 shadow-[0_0_15px_rgba(34,211,238,0.3)] text-cyan-300"
                  : "bg-black/40 border-white/15 hover:border-white/30 text-gray-300 hover:text-white shadow-sm"
              }`}
            >
              <span className="p-1 rounded-full bg-white/10 group-hover:scale-110 transition-transform flex items-center justify-center">
                {isPlayingMusic ? (
                  <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-300 fill-current" />
                ) : (
                  <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-300 fill-current ml-0.5" />
                )}
              </span>

              {/* Animated Equalizer Sound Wave Bars */}
              <div className="flex items-end gap-1 h-4 w-5 sm:w-6" aria-hidden="true">
                <span
                  className={`w-1 rounded-full bg-cyan-400 transition-all duration-300 ${
                    isPlayingMusic ? "animate-[soundWave_0.8s_ease-in-out_infinite_alternate]" : "h-1.5 opacity-40"
                  }`}
                  style={{ height: isPlayingMusic ? undefined : "4px" }}
                />
                <span
                  className={`w-1 rounded-full bg-cyan-300 transition-all duration-300 ${
                    isPlayingMusic ? "animate-[soundWave_1.2s_ease-in-out_infinite_alternate_0.2s]" : "h-2.5 opacity-40"
                  }`}
                  style={{ height: isPlayingMusic ? undefined : "8px" }}
                />
                <span
                  className={`w-1 rounded-full bg-cyan-400 transition-all duration-300 ${
                    isPlayingMusic ? "animate-[soundWave_0.9s_ease-in-out_infinite_alternate_0.4s]" : "h-1 opacity-40"
                  }`}
                  style={{ height: isPlayingMusic ? undefined : "3px" }}
                />
                <span
                  className={`w-1 rounded-full bg-cyan-300 transition-all duration-300 ${
                    isPlayingMusic ? "animate-[soundWave_1.1s_ease-in-out_infinite_alternate_0.1s]" : "h-2 opacity-40"
                  }`}
                  style={{ height: isPlayingMusic ? undefined : "6px" }}
                />
              </div>

              <span className="hidden sm:inline-block text-xs font-mono font-medium tracking-wide">
                {isPlayingMusic ? "Audio ON" : "Ambient"}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. FLOATING BOTTOM-LEFT NAVIGATION TOGGLE BUTTON                          */}
      {/* ========================================================================= */}
      <div className="fixed bottom-6 left-6 z-40 select-none">
        <button
          type="button"
          onClick={() => setIsNavOpen(!isNavOpen)}
          aria-label={isNavOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={isNavOpen}
          className={`group relative cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400 rounded-full p-3 sm:p-3.5 flex items-center justify-center shadow-2xl transition-all duration-300 border ${
            isNavOpen
              ? "bg-[#0f172a] border-cyan-400 text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.4)]"
              : "bg-[#0b0f19] border-white/20 hover:border-cyan-400/60 hover:text-cyan-300 text-white shadow-black/80"
          }`}
        >
          <div className="relative flex items-center gap-2">
            <Compass
              className={`w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-500 ${
                isNavOpen ? "rotate-180 text-cyan-300 scale-105" : "text-white group-hover:rotate-45"
              }`}
            />
            <span className="hidden md:inline-block text-xs font-mono font-bold tracking-wider pr-1">
              MENU
            </span>
          </div>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3. SIDE GLASS NAVIGATION PANEL (Liquid Glass with Realistic Reflections) */}
      {/* ========================================================================= */}
      {isNavOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
          aria-hidden="true"
          onClick={() => setIsNavOpen(false)}
        />
      )}

      <aside
        ref={sidePanelRef}
        aria-label="Site Navigation Panel"
        className={`fixed top-0 left-0 bottom-0 z-50 w-72 sm:w-84 max-w-[85vw] h-full transform transition-transform duration-300 ease-out p-3 sm:p-4 pointer-events-auto select-none ${
          isNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <GlassSurface
          borderRadius={24}
          borderWidth={1.5}
          blur={28}
          opacity={0.76}
          distortionScale={-80}
          className="w-full h-full p-5 sm:p-6 flex flex-col justify-between shadow-2xl border-white/20"
        >
          {/* Panel Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
              <h2 className="text-sm font-mono uppercase tracking-widest text-cyan-300 font-bold">
                Navigation
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setIsNavOpen(false)}
              aria-label="Close navigation panel"
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 py-6 overflow-y-auto">
            <ul className="flex flex-col gap-2">
              {navLinks.map((nav, idx) => {
                const isCurrent = active.toLowerCase() === nav.title.toLowerCase();
                return (
                  <li key={nav.id}>
                    <a
                      href={`#${nav.id}`}
                      onClick={(e) => handleNavClick(e, nav.id, nav.title)}
                      className={`group flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer text-sm sm:text-base font-semibold tracking-wide ${
                        isCurrent
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-xs shadow-cyan-400/20"
                          : "text-gray-300 hover:text-white hover:bg-white/5 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-mono text-gray-500 group-hover:text-cyan-400 transition-colors">
                          0{idx + 1}
                        </span>
                        <span>{nav.title}</span>
                      </div>
                      {isCurrent && (
                        <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Panel Footer */}
          <div className="pt-4 border-t border-white/10 flex flex-col gap-2 text-xs font-mono text-gray-400">
            <div className="flex items-center justify-between">
              <span>Status</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Available for work
              </span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              Ganganathan • Senior Web Architect
            </p>
          </div>
        </GlassSurface>
      </aside>
    </>
  );
};

export default Navbar;
