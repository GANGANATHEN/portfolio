"use client";
import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function useLenisScroll() {
  useEffect(() => {
    // 1. Detect if touch device
    const isTouch =
      typeof window !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0);

    // 2. Optimized Lenis Configuration
    const lenis = new Lenis({
      smoothWheel: true,
      syncTouch: isTouch,
      
      // lerp 0.1 is responsive, 0.05 is floaty. 
      // 0.08 is the perfect balance for portfolios.
      lerp: isTouch ? 0.1 : 0.12, 
      duration: 1.4, 
      
      wheelMultiplier: 1.0, // 1.0 = normal scroll speed
      touchMultiplier: 1.5, // slightly faster on touch for mobile feel
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), 
    });

    // 3. GSAP Ticker Sync
    const raf = (time: number) => {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // 4. ScrollTrigger Sync
    lenis.on("scroll", ScrollTrigger.update);

    // 5. Important: Ensure ScrollTrigger respects Lenis
    ScrollTrigger.defaults({ scroller: document.body });

    // Refresh after everything is mounted
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