"use client";
import React, { useEffect, useRef, useState, useId, useCallback } from "react";

export interface GlassSurfaceProps {
  children?: React.ReactNode;
  width?: number | string;
  height?: number | string;
  borderRadius?: number | string;
  borderWidth?: number;
  brightness?: number;
  opacity?: number;
  blur?: number;
  distortionScale?: number;
  redOffset?: number;
  greenOffset?: number;
  blueOffset?: number;
  className?: string;
  style?: React.CSSProperties;
}

const GlassSurface: React.FC<GlassSurfaceProps> = ({
  children,
  width,
  height,
  borderRadius = 24,
  borderWidth = 1.5,
  brightness = 1.12,
  opacity = 0.76,
  blur = 28,
  distortionScale = -80,
  redOffset = 12,
  greenOffset = 6,
  blueOffset = 2,
  className = "",
  style = {},
}) => {
  const uniqueId = useId().replace(/:/g, "");
  const filterId = `liquid-glass-filter-${uniqueId}`;
  const redChannelRef = useRef<SVGFEDisplacementMapElement>(null);
  const greenChannelRef = useRef<SVGFEDisplacementMapElement>(null);
  const blueChannelRef = useRef<SVGFEDisplacementMapElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dynamic specular light reflection tracking (defaults to upper-left natural lighting angle)
  const [reflectionPos, setReflectionPos] = useState({ x: 25, y: 18 });

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100));
    setReflectionPos({ x, y });
  }, []);

  const handlePointerLeave = useCallback(() => {
    setReflectionPos({ x: 25, y: 18 });
  }, []);

  useEffect(() => {
    if (redChannelRef.current) {
      redChannelRef.current.scale.baseVal = distortionScale + redOffset;
    }
    if (greenChannelRef.current) {
      greenChannelRef.current.scale.baseVal = distortionScale + greenOffset;
    }
    if (blueChannelRef.current) {
      blueChannelRef.current.scale.baseVal = distortionScale + blueOffset;
    }
  }, [distortionScale, redOffset, greenOffset, blueOffset]);

  const parsedRadius = typeof borderRadius === "number" ? `${borderRadius}px` : borderRadius;

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`relative overflow-hidden group/glass ${className}`}
      style={{
        width: width !== undefined ? width : "auto",
        height: height !== undefined ? height : "auto",
        borderRadius: parsedRadius,
        backgroundColor: `rgba(10, 16, 32, ${opacity})`,
        backdropFilter: `blur(${blur}px) saturate(180%) brightness(${brightness})`,
        WebkitBackdropFilter: `blur(${blur}px) saturate(180%) brightness(${brightness})`,
        boxShadow: `
          0 25px 60px -15px rgba(0, 0, 0, 0.75),
          0 0 0 ${borderWidth}px rgba(255, 255, 255, 0.18),
          inset 0 1.5px 2px 0 rgba(255, 255, 255, 0.45),
          inset 1.5px 0 2px 0 rgba(255, 255, 255, 0.3),
          inset -1px -1px 3px 0 rgba(0, 0, 0, 0.5),
          inset 0 0 35px 0 rgba(0, 0, 0, 0.35)
        `,
        border: `${borderWidth}px solid rgba(255, 255, 255, 0.16)`,
        ...style,
      }}
    >
      {/* SVG Liquid Refraction Filter with Chromatic Aberration */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-45 mix-blend-overlay"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.015 0.02"
              numOctaves="3"
              seed="7"
              result="noise"
            />
            <feDisplacementMap
              ref={redChannelRef}
              in="SourceGraphic"
              in2="noise"
              xChannelSelector="R"
              yChannelSelector="G"
              result="red-channel"
            />
            <feDisplacementMap
              ref={greenChannelRef}
              in="SourceGraphic"
              in2="noise"
              xChannelSelector="G"
              yChannelSelector="B"
              result="green-channel"
            />
            <feDisplacementMap
              ref={blueChannelRef}
              in="SourceGraphic"
              in2="noise"
              xChannelSelector="B"
              yChannelSelector="R"
              result="blue-channel"
            />
            <feMerge>
              <feMergeNode in="red-channel" />
              <feMergeNode in="green-channel" />
              <feMergeNode in="blue-channel" />
            </feMerge>
          </filter>
        </defs>
        <rect
          width="100%"
          height="100%"
          filter={`url(#${filterId})`}
          fill="none"
        />
      </svg>

      {/* Layer 1: Diagonal Primary Specular Sheen (Curved Glass Glare Beam) */}
      <div
        className="absolute inset-0 bg-linear-to-br from-white/20 via-white/5 to-transparent pointer-events-none"
        aria-hidden="true"
      />

      {/* Layer 2: Prismatic Optical Caustic Dispersion Highlight */}
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_120%_60%_at_15%_0%,rgba(34,211,238,0.18)_0%,rgba(168,85,247,0.1)_35%,rgba(255,255,255,0.03)_65%,transparent_85%)] pointer-events-none"
        aria-hidden="true"
      />

      {/* Layer 3: Interactive Smooth Specular Highlight (Follows pointer coordinates or rests naturally) */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-300 ease-out"
        style={{
          background: `radial-gradient(circle 260px at ${reflectionPos.x}% ${reflectionPos.y}%, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.04) 45%, transparent 75%)`,
        }}
        aria-hidden="true"
      />

      {/* Layer 4: Top Razor Specular Bevel Line (Sharp Top Light Catcher) */}
      <div
        className="absolute inset-x-0 top-0 h-[1.5px] bg-linear-to-r from-white/70 via-white/30 to-transparent pointer-events-none"
        aria-hidden="true"
      />

      {/* Layer 5: Left Razor Specular Bevel Line (Sharp Left Light Catcher) */}
      <div
        className="absolute inset-y-0 left-0 w-[1.5px] bg-linear-to-b from-white/70 via-white/25 to-transparent pointer-events-none"
        aria-hidden="true"
      />

      {/* Layer 6: Ambient Internal Glass Vignette for 3D Convex Depth */}
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.35)_100%)] pointer-events-none"
        aria-hidden="true"
      />

      {/* Surface Content - Fully readable with sharp contrast */}
      <div className="relative z-10 w-full h-full flex flex-col justify-between">
        {children}
      </div>
    </div>
  );
};

export default GlassSurface;
