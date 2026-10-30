"use client";
import React, { Suspense, useEffect, useState, type FC } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Preload, useGLTF } from "@react-three/drei";
import CanvasLoader from "../Loader";

type ComputersProps = {
  isMobile: boolean;
  isTablet: boolean;
  setHovered: (v: boolean) => void;
};

const Computers: FC<ComputersProps> = ({
  isMobile,
  isTablet,
  setHovered,
}) => {
  const { scene } = useGLTF("/desktop_pc/scene.gltf");

  // Dynamic Scale & Position logic
  const getScale = () => {
    if (isMobile) return 0.35;
    if (isTablet) return 0.5;
    return 0.8;
  };

  const getPosition = (): [number, number, number] => {
    if (isMobile) return [0, -2, -0.48];
    if (isTablet) return [0, -3.25, -1];
    return [0, -3.75, -1.5];
  };

  return (
    <group
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <hemisphereLight intensity={2.15} groundColor="black" />
      <spotLight
        position={[-100, 50, 100]}
        angle={0.12}
        penumbra={1}
        intensity={4}
        castShadow
        shadow-mapSize={1024}
      />
      <pointLight intensity={2} />
      <primitive
        object={scene}
        scale={getScale()}
        position={getPosition()}
        rotation={[-0.01, -0.2, -0.12]}
      />
    </group>
  );
};

const WorkstationFallback = () => (
  <div className="w-full h-full flex flex-col items-center justify-center p-6 select-none pointer-events-none">
    <div className="relative w-64 sm:w-84 h-44 sm:h-56 rounded-2xl bg-linear-to-b from-[#151030] to-[#050816] border border-cyan-500/30 shadow-2xl shadow-cyan-500/10 flex flex-col items-center justify-center p-4">
      <div className="w-full h-full rounded-xl bg-black/85 border border-white/10 p-3.5 flex flex-col justify-between font-mono">
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <span className="text-[10px] text-cyan-400">~/ganganathan/terminal</span>
        </div>
        <div className="space-y-1.5 text-[11px] text-gray-300">
          <p className="text-cyan-300">$ npx portfolio --interactive</p>
          <p className="text-emerald-400 font-semibold">✔ Full-Stack Architecture Ready</p>
          <p className="text-gray-400">⚡ Next.js • TypeScript • 3D Experiences</p>
        </div>
        <div className="text-[10px] text-gray-500 flex items-center justify-between pt-1 border-t border-white/5">
          <span>Workstation Ready</span>
          <span className="animate-pulse text-cyan-400 font-bold">ONLINE</span>
        </div>
      </div>
      <div className="w-20 h-3 bg-linear-to-b from-gray-700 to-gray-900 rounded-b-md mx-auto" />
      <div className="w-32 h-1 bg-cyan-400/50 rounded-full mx-auto mt-0.5 shadow-xs shadow-cyan-400" />
    </div>
  </div>
);

class ComputersErrorBoundary extends React.Component<
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
      return <WorkstationFallback />;
    }
    return this.props.children;
  }
}

const ComputersCanvas = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleResize = () => {
      const mobile = window.innerWidth <= 500;
      const tablet = window.innerWidth <= 1024 && window.innerWidth > 500;
      setIsMobile(mobile);
      setIsTablet(tablet);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!mounted) {
    return <WorkstationFallback />;
  }

  return (
    <ComputersErrorBoundary>
      <Canvas
        frameloop="demand"
        shadows
        dpr={[1, 2]}
        camera={{
          position: isMobile ? [15, 3, 5] : [20, 3, 5],
          fov: isMobile ? 35 : 25,
        }}
        gl={{
          antialias: true,
          preserveDrawingBuffer: false,
          powerPreference: "high-performance",
          alpha: true,
        }}
        onCreated={(state) => {
          // Explicitly clear to dark background with alpha 0 to prevent mobile white flash
          state.gl.setClearColor(0x050816, 0);
        }}
        style={{
          cursor: isHovered ? (isDragging ? "grabbing" : "grab") : "auto",
          background: "transparent",
        }}
      >
        <Suspense fallback={<CanvasLoader />}>
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            enableRotate={true}
            onStart={() => setIsDragging(true)}
            onEnd={() => setIsDragging(false)}
            maxPolarAngle={Math.PI / 2}
            minPolarAngle={Math.PI / 2}
          />
          <Computers
            isMobile={isMobile}
            isTablet={isTablet}
            setHovered={setIsHovered}
          />
        </Suspense>
        <Preload all />
      </Canvas>
    </ComputersErrorBoundary>
  );
};

export default ComputersCanvas;
