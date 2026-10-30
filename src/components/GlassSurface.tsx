"use client";
import React, { useEffect, useRef, useId } from "react";

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
  borderWidth = 1,
  brightness = 1.1,
  opacity = 0.85,
  blur = 20,
  distortionScale = -120,
  redOffset = 10,
  greenOffset = 6,
  blueOffset = 3,
  className = "",
  style = {},
}) => {
  const uniqueId = useId().replace(/:/g, "");
  const filterId = `liquid-glass-filter-${uniqueId}`;
  const redChannelRef = useRef<SVGFEDisplacementMapElement>(null);
  const greenChannelRef = useRef<SVGFEDisplacementMapElement>(null);
  const blueChannelRef = useRef<SVGFEDisplacementMapElement>(null);

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
      className={`relative overflow-hidden ${className}`}
      style={{
        width: width !== undefined ? width : "auto",
        height: height !== undefined ? height : "auto",
        borderRadius: parsedRadius,
        backgroundColor: `rgba(14, 20, 36, ${opacity})`,
        backdropFilter: `blur(${blur}px) brightness(${brightness})`,
        WebkitBackdropFilter: `blur(${blur}px) brightness(${brightness})`,
        boxShadow: `0 8px 32px 0 rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 -1px 0 rgba(255, 255, 255, 0.05)`,
        border: `${borderWidth}px solid rgba(255, 255, 255, 0.15)`,
        ...style,
      }}
    >
      {/* SVG Liquid Refraction Filter */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-40 mix-blend-overlay"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <filter id={filterId} x="0%" y="0%" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.02"
              numOctaves="3"
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

      {/* Surface Specular & Sheen Highlights */}
      <div
        className="absolute inset-x-0 top-0 h-1/2 bg-linear-to-b from-white/15 to-transparent pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.12)_0%,transparent_60%)] pointer-events-none"
        aria-hidden="true"
      />

      {/* Surface Content */}
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </div>
  );
};

export default GlassSurface;

