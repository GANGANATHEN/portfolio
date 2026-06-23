'use client';

import { useLenisScroll } from "@/utils/lenis";

// import { useLocomotiveScroll } from "@/utils/locomotive";


export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  useLenisScroll()
  // useLocomotiveScroll()

  return <>{children}</>;
}