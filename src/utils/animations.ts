import gsap from "gsap";

// --- UNGA EXISTING FUNCTIONS ---

export const animateText = (target: string, delay: number = 0) => {
  return gsap.from(target, {
    y: -50,
    opacity: 0,
    duration: 1.25,
    delay: delay,
    ease: "power2.out",
  });
};

export const fadeIn = (target: string, direction: string, delay: number, duration: number) => {
  const xValue = direction === "left" ? 100 : direction === "right" ? -100 : 0;
  const yValue = direction === "up" ? 100 : direction === "down" ? -100 : 0;

  return gsap.from(target, {
    x: xValue,
    y: yValue,
    opacity: 0,
    duration: duration,
    delay: delay,
    ease: "power2.out",
  });
};

export const slideIn = (target: string, direction: string, delay: number, duration: number) => {
  const xValue = direction === "left" ? "-100%" : direction === "right" ? "100%" : 0;
  const yValue = direction === "up" ? "100%" : direction === "down" ? "100%" : 0;

  return gsap.from(target, {
    x: xValue,
    y: yValue,
    duration: duration,
    delay: delay,
    ease: "power2.out",
  });
};

// --- PUTHU HERO ANIMATIONS (Awwwards Style) ---

export const revealText = (target: string, delay: number = 0) => {
  return gsap.from(target, {
    y: 100, 
    opacity: 0,
    duration: 1.2,
    stagger: 0.15,
    ease: "power4.out",
    delay: delay,
  });
};

export const revealChars = (target: string, delay: number = 0) => {
  return gsap.from(target, {
    x: -100,
    opacity: 0,
    duration: 1,
    stagger: 0.15,
    ease: "power4.out",
    delay: delay,
  });
};

export const popIn = (target: string, delay: number = 0) => {
  return gsap.from(target, {
    scale: 0,
    opacity: 0,
    duration: 1.5,
    ease: "elastic.out(1, 0.4)",
    delay: delay,
  });
};

export const drawLineVertical = (target: string, delay: number = 0) => {
  return gsap.from(target, {
    scaleY: 0,
    transformOrigin: "top", 
    duration: 1.5,
    ease: "power3.inOut",
    delay: delay,
  });
};

export const floatAnimation = (target: string) => {
  return gsap.to(target, {
    y: 24,
    duration: 1.5,
    repeat: -1,
    yoyo: true,
    ease: "power1.inOut",
  });
};