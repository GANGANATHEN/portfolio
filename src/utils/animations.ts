import gsap from "gsap";

// Framer Motion-oda `textVariant` -> GSAP Tween
export const animateText = (target: string, delay: number = 0) => {
  return gsap.from(target, {
    y: -50,
    opacity: 0,
    duration: 1.25,
    delay: delay,
    ease: "power2.out",
  });
};

// Framer Motion-oda `fadeIn` -> GSAP Tween
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

// Framer Motion-oda `slideIn` -> GSAP Tween
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