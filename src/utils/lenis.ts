import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export const initLenis = () => {
  const lenis = new Lenis({
    lerp: 0.1, // Smoothness level (0.1 is smooth, 0.05 is extra smooth)
    duration: 1.5,
    smoothWheel: true,
    smoothTouch: true, // Mobile-kum smooth scroll-ah irukkum
    syncTouch: true,
  });

  function raf(time: number) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }

  requestAnimationFrame(raf);

  // GSAP ScrollTrigger sync
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  return lenis; // Cleanup-kku return panrom
};