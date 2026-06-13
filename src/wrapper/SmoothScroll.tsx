'use client';

import { useLenisScroll } from "@/utils/lenis";

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  useLenisScroll()

  return <>{children}</>;
}