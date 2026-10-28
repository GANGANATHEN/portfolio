"use client";
import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function useLenisScroll() {
  useEffect(() => {
    // Check for reduced motion preference
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) return;

    // Detect if touch device
    const isTouch =
      typeof window !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0);

    // Optimized Lenis Configuration
    const lenis = new Lenis({
      smoothWheel: true,
      syncTouch: false, // Keep native touch scroll on mobile for natural physics
      lerp: isTouch ? 0.1 : 0.09,
      duration: 1.2,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });

    // GSAP Ticker Sync
    const raf = (time: number) => {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // ScrollTrigger Sync
    lenis.on("scroll", ScrollTrigger.update);

    // Initial refresh
    requestAnimationFrame(() => {
      ScrollTrigger.refresh();
    });

    // Cleanup
    return () => {
      lenis.destroy();
      gsap.ticker.remove(raf);
    };
  }, []);
}
