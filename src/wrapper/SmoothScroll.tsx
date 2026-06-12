'use client';
import { useEffect } from 'react';
import { initLenis } from '@/utils/lenis';

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const lenis = initLenis();
    
    return () => {
      lenis.destroy(); // Unmount aagum pothu stop aagidum
    };
  }, []);

  return <>{children}</>;
}