"use client";
import React, { Suspense, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Preload, useGLTF } from "@react-three/drei";
import CanvasLoader from "../Loader";

type EarthProps = {
  setHovered: (hovered: boolean) => void;
  isMobile: boolean;
};

const Earth = ({ setHovered, isMobile }: EarthProps) => {
  const { scene } = useGLTF("/planet/scene.gltf");

  return (
    <group
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Responsive scale preventing horizontal overflow on mobile screens */}
      <primitive
        object={scene}
        scale={isMobile ? 2.2 : 2.6}
        position={[0, 0, 0]}
        rotation={[0, 0, 0]}
      />
    </group>
  );
};

class EarthErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-44 h-44 sm:w-60 sm:h-60 rounded-full bg-radial from-cyan-500/20 via-blue-900/40 to-black border-2 border-cyan-400/30 flex items-center justify-center animate-pulse shadow-2xl shadow-cyan-500/20">
            <span className="text-4xl">🌍</span>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const EarthCanvas = () => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-40 h-40 sm:w-56 sm:h-56 rounded-full bg-cyan-500/10 border border-cyan-500/20 animate-pulse" />
      </div>
    );
  }

  return (
    <EarthErrorBoundary>
      <Canvas
        shadows
        frameloop="demand"
        dpr={[1, 2]}
        gl={{ preserveDrawingBuffer: false, antialias: true, alpha: true }}
        camera={{
          fov: isMobile ? 45 : 45,
          near: 0.1,
          far: 1000,
          position: isMobile ? [-4.5, 2.5, 6] : [-4, 3, 6],
        }}
        onCreated={(state) => {
          state.gl.setClearColor(0x020205, 0);
          state.gl.domElement.style.setProperty("touch-action", "pan-y", "important");
        }}
        style={{
          width: "100%",
          height: "100%",
          cursor: isHovered ? (isDragging ? "grabbing" : "grab") : "auto",
          touchAction: "pan-y",
        }}
      >
        <Suspense fallback={<CanvasLoader />}>
          <ambientLight intensity={1.8} />
          <directionalLight position={[5, 3, 5]} intensity={2.6} />
          <directionalLight position={[-5, -3, -5]} intensity={1.4} />
          <pointLight position={[0, 5, 0]} intensity={1.8} />
          <OrbitControls
            autoRotate
            enableZoom={false}
            maxPolarAngle={Math.PI / 2}
            minPolarAngle={Math.PI / 2}
            enableRotate={true}
            onStart={() => setIsDragging(true)}
            onEnd={() => setIsDragging(false)}
          />
          <Earth setHovered={setIsHovered} isMobile={isMobile} />
          <Preload all />
        </Suspense>
      </Canvas>
    </EarthErrorBoundary>
  );
};

export default EarthCanvas;
