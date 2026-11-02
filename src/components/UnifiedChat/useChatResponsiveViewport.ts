"use client";
import { useState, useEffect } from "react";

export interface ChatViewportInfo {
  visualHeight: number;
  visualWidth: number;
  isKeyboardOpen: boolean;
  keyboardHeight: number;
  isMobile: boolean;
  isVisualViewportSupported: boolean;
  offsetTop: number;
}

function computeViewportInfo(): ChatViewportInfo {
  if (typeof window === "undefined") {
    return {
      visualHeight: 800,
      visualWidth: 1200,
      isKeyboardOpen: false,
      keyboardHeight: 0,
      isMobile: false,
      isVisualViewportSupported: false,
      offsetTop: 0,
    };
  }

  const isMobile = window.innerWidth < 640;
  const visualViewport = window.visualViewport;

  if (visualViewport) {
    const visualHeight = Math.round(visualViewport.height);
    const visualWidth = Math.round(visualViewport.width);
    const windowHeight = window.innerHeight;
    const offsetTop = Math.max(0, Math.round(visualViewport.offsetTop));

    // On mobile devices, virtual keyboard decreases visualViewport.height significantly
    const diff = windowHeight - visualHeight;
    const isKeyboardOpen = isMobile && diff > 130;
    const keyboardHeight = isKeyboardOpen ? diff : 0;

    return {
      visualHeight,
      visualWidth,
      isKeyboardOpen,
      keyboardHeight,
      isMobile,
      isVisualViewportSupported: true,
      offsetTop,
    };
  }

  return {
    visualHeight: window.innerHeight,
    visualWidth: window.innerWidth,
    isKeyboardOpen: false,
    keyboardHeight: 0,
    isMobile,
    isVisualViewportSupported: false,
    offsetTop: 0,
  };
}

export function useChatResponsiveViewport(
  isOpen: boolean = true,
  isFullscreen: boolean = false
): ChatViewportInfo {
  const [viewportInfo, setViewportInfo] = useState<ChatViewportInfo>(computeViewportInfo);

  useEffect(() => {
    if (typeof window === "undefined" || !isOpen) return;

    const handleUpdate = () => {
      setViewportInfo(computeViewportInfo());
    };

    const visualViewport = window.visualViewport;
    if (visualViewport) {
      visualViewport.addEventListener("resize", handleUpdate);
      visualViewport.addEventListener("scroll", handleUpdate);
    }
    window.addEventListener("resize", handleUpdate);
    window.addEventListener("orientationchange", handleUpdate);

    return () => {
      if (visualViewport) {
        visualViewport.removeEventListener("resize", handleUpdate);
        visualViewport.removeEventListener("scroll", handleUpdate);
      }
      window.removeEventListener("resize", handleUpdate);
      window.removeEventListener("orientationchange", handleUpdate);
    };
  }, [isOpen, isFullscreen]);

  return viewportInfo;
}
