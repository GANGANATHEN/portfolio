"use client";
import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface Point {
  x: number;
  y: number;
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
  const numParticles = 1200;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", resize);
    resize();

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // SVG Point Generator Logic
    const getPathPoints = (pathData: string): Point[] => {
      const offscreen = document.createElement("canvas");
      offscreen.width = 1000;
      offscreen.height = 1000;
      const oCtx = offscreen.getContext("2d")!;

      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      path.setAttribute("d", pathData);
      const bbox = path.getBBox();

      const scale = 500 / Math.max(bbox.width, bbox.height);
      oCtx.fillStyle = "white";
      oCtx.translate(250, 350);
      oCtx.scale(scale, scale);
      oCtx.translate(-(bbox.x + bbox.width / 2), -(bbox.y + bbox.height / 2));
      oCtx.fill(new Path2D(pathData));

      const imgData = oCtx.getImageData(0, 0, 1000, 1000);
      const points: Point[] = [];
      for (let i = 0; i < imgData.data.length; i += 4) {
        if (imgData.data[i + 3] > 128) {
          const idx = i / 4;
          points.push({
            x: ((idx % 1000) - 500) * 0.5,
            y: (Math.floor(idx / 1000) - 500) * 0.5,
          });
        }
      }
      const SCALE_MULTIPLIER = 4.2; 

      return Array.from({ length: numParticles }, () => {
        const p = points[Math.floor(Math.random() * points.length)] || {
          x: 0,
          y: 0,
        };
        return {
          x: centerX + p.x * SCALE_MULTIPLIER,
          y: centerY + p.y * SCALE_MULTIPLIER,
        };
      });
    };

    class ParticleImpl implements Particle {
      x = Math.random() * canvas.width;
      y = Math.random() * canvas.height;
      targetX = centerX;
      targetY = centerY;
      vx = 0;
      vy = 0;
      friction = 0.95;
      spring = 0.08;
      update() {
        this.vx += (this.targetX - this.x) * this.spring;
        this.vy += (this.targetY - this.y) * this.spring;
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.x += this.vx;
        this.y += this.vy;
      }
      draw(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = "#60a5fa";
        ctx.fillRect(this.x, this.y, 2, 2);
      }
    }

    // Initialize shape
    const paths = [
      "M250,50 L350,100 L350,200 L250,250 L150,200 L150,100 Z",
      "M250,50 L400,300 L100,300 Z",
      "M250,50 L400,150 L250,250 L100,150 Z"
    ];
    const shapePoints = paths.map(getPathPoints);

    for (let i = 0; i < numParticles; i++) {
      const p = new ParticleImpl();
      p.targetX = shapePoints[0][i].x;
      p.targetY = shapePoints[0][i].y;
      particles.current.push(p);
    }

    // Scroll Animation
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: wrapperRef.current,
        start: "top top",
        end: "bottom bottom",
        scrub: 1,
      },
    });
    

    shapePoints.forEach((points, sIdx) => {
      if (sIdx === 0) return;
      particles.current.forEach((p, i) => {
        tl.to(p, { targetX: points[i].x, targetY: points[i].y }, 0);
      });
    });

    const render = () => {
      ctx.fillStyle = "#050816";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      particles.current.forEach((p) => {
        p.update();
        p.draw(ctx);
      });
      requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener("resize", resize);
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return (
    <div ref={wrapperRef} className="w-full relative">
      <canvas ref={canvasRef} className="fixed top-0 left-0 -z-10" />
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}
