"use client";
import React from "react";

/**
 * Realistic Liquid Glass Water Droplets Overlay
 * Renders naturally scattered, physics-inspired water droplets with
 * specular highlights, soft contact shadows, and caustic refraction.
 */
export const WaterDropletsOverlay: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <svg
      className={`absolute inset-0 w-full h-full pointer-events-none overflow-hidden select-none ${className}`}
      viewBox="0 0 1000 60"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        {/* Soft Contact Shadow under droplets */}
        <filter id="droplet-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1" floodColor="#000000" floodOpacity="0.45" />
        </filter>

        {/* Liquid Body Radial Gradient - simulates convex refraction */}
        <radialGradient id="drop-body" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="30%" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="70%" stopColor="#050816" stopOpacity="0.1" />
          <stop offset="90%" stopColor="#050816" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.35" />
        </radialGradient>

        {/* Micro-droplet Gradient */}
        <radialGradient id="micro-body" cx="35%" cy="30%" r="60%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="85%" stopColor="#000000" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.25" />
        </radialGradient>

        {/* Specular Highlight Gradient */}
        <linearGradient id="drop-specular" x1="0%" y1="0%" x2="60%" y2="80%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="40%" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {/* Cyan Caustic Accent Gradient */}
        <radialGradient id="caustic-accent" cx="65%" cy="75%" r="40%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Layer 1: Left Cluster Droplets (Near Brand Logo) */}
      <g filter="url(#droplet-shadow)">
        {/* Organic Medium Droplet */}
        <ellipse cx="140" cy="18" rx="7" ry="5.5" fill="url(#drop-body)" />
        <ellipse cx="138" cy="16" rx="3.5" ry="2" fill="url(#drop-specular)" />
        <circle cx="142" cy="20" r="2.2" fill="url(#caustic-accent)" />

        {/* Small Companion Drop */}
        <circle cx="156" cy="38" r="4.2" fill="url(#drop-body)" />
        <circle cx="154.5" cy="36.5" r="1.8" fill="url(#drop-specular)" />

        {/* Micro Beads */}
        <circle cx="125" cy="42" r="2.2" fill="url(#micro-body)" />
        <circle cx="168" cy="22" r="1.8" fill="url(#micro-body)" />
        <circle cx="112" cy="25" r="1.5" fill="url(#micro-body)" />
      </g>

      {/* Layer 2: Center-Left Nav Gap Droplets */}
      <g filter="url(#droplet-shadow)">
        {/* Elongated Water Bead */}
        <ellipse cx="310" cy="15" rx="8" ry="6" transform="rotate(-15 310 15)" fill="url(#drop-body)" />
        <ellipse cx="308" cy="13" rx="4" ry="2.2" transform="rotate(-15 308 13)" fill="url(#drop-specular)" />
        <circle cx="312" cy="17" r="2.5" fill="url(#caustic-accent)" />

        {/* Micro droplet scatter */}
        <circle cx="328" cy="32" r="2.4" fill="url(#micro-body)" />
        <circle cx="295" cy="40" r="1.6" fill="url(#micro-body)" />
        <circle cx="340" cy="20" r="2.8" fill="url(#drop-body)" />
        <circle cx="339" cy="19" r="1.2" fill="url(#drop-specular)" />
      </g>

      {/* Layer 3: Central Ambient Droplets */}
      <g filter="url(#droplet-shadow)">
        {/* Prominent Spherical Droplet */}
        <circle cx="510" cy="42" r="6.5" fill="url(#drop-body)" />
        <ellipse cx="508" cy="39.5" rx="3.2" ry="1.8" fill="url(#drop-specular)" />
        <circle cx="512" cy="44" r="2.4" fill="url(#caustic-accent)" />

        {/* Micro condensation beads */}
        <circle cx="495" cy="22" r="2" fill="url(#micro-body)" />
        <circle cx="528" cy="36" r="1.8" fill="url(#micro-body)" />
        <circle cx="475" cy="38" r="2.5" fill="url(#drop-body)" />
        <circle cx="474" cy="37" r="1.1" fill="url(#drop-specular)" />
        <circle cx="545" cy="18" r="1.5" fill="url(#micro-body)" />
      </g>

      {/* Layer 4: Center-Right Nav Gap Droplets */}
      <g filter="url(#droplet-shadow)">
        {/* Organic Asymmetrical Droplet */}
        <ellipse cx="690" cy="17" rx="7.5" ry="5.8" transform="rotate(10 690 17)" fill="url(#drop-body)" />
        <ellipse cx="688" cy="15" rx="3.6" ry="2" transform="rotate(10 688 15)" fill="url(#drop-specular)" />
        <circle cx="692" cy="19" r="2.2" fill="url(#caustic-accent)" />

        {/* Scattered droplets */}
        <circle cx="708" cy="38" r="3.2" fill="url(#drop-body)" />
        <circle cx="707" cy="37" r="1.4" fill="url(#drop-specular)" />
        <circle cx="672" cy="32" r="2" fill="url(#micro-body)" />
        <circle cx="725" cy="22" r="1.6" fill="url(#micro-body)" />
      </g>

      {/* Layer 5: Right Edge Cluster Droplets */}
      <g filter="url(#droplet-shadow)">
        {/* Medium teardrop shape */}
        <ellipse cx="880" cy="36" rx="6.5" ry="5" transform="rotate(-8 880 36)" fill="url(#drop-body)" />
        <ellipse cx="878" cy="34" rx="3.2" ry="1.8" transform="rotate(-8 878 34)" fill="url(#drop-specular)" />
        <circle cx="882" cy="38" r="2" fill="url(#caustic-accent)" />

        {/* Condensation micro-scatter */}
        <circle cx="896" cy="18" r="2.5" fill="url(#drop-body)" />
        <circle cx="895" cy="17" r="1.1" fill="url(#drop-specular)" />
        <circle cx="862" cy="20" r="1.8" fill="url(#micro-body)" />
        <circle cx="915" cy="35" r="2.2" fill="url(#micro-body)" />
        <circle cx="930" cy="25" r="1.5" fill="url(#micro-body)" />
      </g>
    </svg>
  );
};

export default WaterDropletsOverlay;

