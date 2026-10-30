"use client";
import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface NormPoint {
  x: number; // -1 to 1
  y: number; // -1 to 1
}

interface Particle {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  friction: number;
  spring: number;
  update: () => void;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

export default function MultiShapeMorph({
  children,
}: {
  children: React.ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const particles = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Respect reduced motion
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let animationFrameId: number;
    let tl: gsap.core.Timeline | null = null;

    const isMobile = window.innerWidth <= 640;
    const numParticles = isMobile ? 400 : 750;

    // SVG shape definition paths
    const paths = [
      "M250,50 L350,100 L350,200 L250,250 L150,200 L150,100 Z", // Hexagon
      "M250,50 L400,300 L100,300 Z",                             // Triangle
      "M250,50 L400,150 L250,250 L100,150 Z",                     // Diamond
    ];

    // Normalized point sampler for arbitrary SVG path: maps points to [-1, 1] bounds
    const getNormalizedPoints = (pathData: string): NormPoint[] => {
      const offscreen = document.createElement("canvas");
      offscreen.width = 600;
      offscreen.height = 600;
      const oCtx = offscreen.getContext("2d");

      if (!oCtx) {
        return Array.from({ length: numParticles }, () => ({
          x: (Math.random() - 0.5) * 1.6,
          y: (Math.random() - 0.5) * 1.6,
        }));
      }

      try {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.style.position = "absolute";
        svg.style.opacity = "0";
        svg.style.pointerEvents = "none";
        document.body.appendChild(svg);

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", pathData);
        svg.appendChild(path);

        const bbox = path.getBBox();
        document.body.removeChild(svg);

        const width = bbox.width || 300;
        const height = bbox.height || 300;
        const maxDim = Math.max(width, height);
        const scale = 400 / maxDim;

        oCtx.fillStyle = "white";
        oCtx.translate(300, 300);
        oCtx.scale(scale, scale);
        oCtx.translate(-(bbox.x + width / 2), -(bbox.y + height / 2));
        oCtx.fill(new Path2D(pathData));

        const imgData = oCtx.getImageData(0, 0, 600, 600);
        const pts: NormPoint[] = [];

        for (let i = 0; i < imgData.data.length; i += 4) {
          if (imgData.data[i + 3] > 128) {
            const idx = i / 4;
            const px = (idx % 600) - 300;
            const py = Math.floor(idx / 600) - 300;
            pts.push({
              x: px / 200,
              y: py / 200,
            });
          }
        }

        if (pts.length === 0) throw new Error("No points sampled");

        return Array.from({ length: numParticles }, () => {
          return pts[Math.floor(Math.random() * pts.length)];
        });
      } catch {
        return Array.from({ length: numParticles }, () => ({
          x: (Math.random() - 0.5) * 1.5,
          y: (Math.random() - 0.5) * 1.5,
        }));
      }
    };

    const normalizedShapes: NormPoint[][] = paths.map(getNormalizedPoints);

    // Responsive Radius calculation
    const getRadius = (w: number, h: number): number => {
      const minDim = Math.min(w, h);
      if (w <= 480) {
        // Fits safely inside 320px-480px viewports without horizontal clipping
        return Math.min(w * 0.36, 125);
      } else if (w <= 768) {
        return Math.min(minDim * 0.34, 190);
      }
      return Math.min(minDim * 0.36, 310);
    };

    let width = window.innerWidth;
    let height = window.innerHeight;
    let radius = getRadius(width, height);
    let centerX = width / 2;
    let centerY = height / 2;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      centerX = width / 2;
      centerY = height / 2;
      radius = getRadius(width, height);
    };
    window.addEventListener("resize", resize);
    resize();

    class ParticleImpl implements Particle {
      x = Math.random() * width;
      y = Math.random() * height;
      targetX = centerX;
      targetY = centerY;
      vx = 0;
      vy = 0;
      friction = 0.94;
      spring = isMobile ? 0.09 : 0.08;

      update() {
        this.vx += (this.targetX - this.x) * this.spring;
        this.vy += (this.targetY - this.y) * this.spring;
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.x += this.vx;
        this.y += this.vy;
      }

      draw(context: CanvasRenderingContext2D) {
        context.fillStyle = "rgba(96, 165, 250, 0.45)";
        context.fillRect(this.x, this.y, 2, 2);
      }
    }

    particles.current = [];
    for (let i = 0; i < numParticles; i++) {
      const p = new ParticleImpl();
      const normPt = normalizedShapes[0][i] || { x: 0, y: 0 };
      p.targetX = centerX + normPt.x * radius;
      p.targetY = centerY + normPt.y * radius;
      particles.current.push(p);
    }

    const morphProgress = { value: 0 };

    const updateParticleTargets = (progressVal: number) => {
      const fromIndex = Math.min(Math.floor(progressVal), normalizedShapes.length - 2);
      const fraction = progressVal - fromIndex;
      const fromPts = normalizedShapes[fromIndex];
      const toPts = normalizedShapes[fromIndex + 1];

      particles.current.forEach((p, i) => {
        const startP = fromPts[i];
        const endP = toPts[i];
        if (startP && endP) {
          const normX = startP.x + (endP.x - startP.x) * fraction;
          const normY = startP.y + (endP.y - startP.y) * fraction;
          p.targetX = centerX + normX * radius;
          p.targetY = centerY + normY * radius;
        }
      });
    };

    if (!prefersReducedMotion && wrapperRef.current) {
      tl = gsap.timeline({
        scrollTrigger: {
          trigger: wrapperRef.current,
          start: "top top",
          end: "bottom bottom",
          scrub: 1,
          onUpdate: () => {
            updateParticleTargets(morphProgress.value);
          },
        },
      });

      tl.to(morphProgress, {
        value: normalizedShapes.length - 1,
        ease: "none",
      });
    }

    const render = () => {
      ctx.fillStyle = "#050816";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      particles.current.forEach((p) => {
        p.update();
        p.draw(ctx);
      });
      animationFrameId = requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener("resize", resize);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (tl) {
        tl.scrollTrigger?.kill();
        tl.kill();
      }
    };
  }, []);

  return (
    <div ref={wrapperRef} className="w-full relative overflow-hidden">
      <canvas
        ref={canvasRef}
        className="fixed top-0 left-0 -z-10 pointer-events-none"
        aria-hidden="true"
      />
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}
