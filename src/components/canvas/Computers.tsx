"use client";
import { Suspense, useEffect, useState, type FC } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Preload, useGLTF } from "@react-three/drei";
import CanvasLoader from "../Loader";

type ComputersProps = {
  isMobile: boolean;
  isTablet: boolean;
  setHovered: (v: boolean) => void;
};

const Computers: FC<ComputersProps> = ({ isMobile, isTablet, setHovered }) => {
  const { scene } = useGLTF("/desktop_pc/scene.gltf");

  // Dynamic Scale & Position logic
  const getScale = () => {
    if (isMobile) return 0.25;
    if (isTablet) return 0.5;
    return 0.8;
  };

  const getPosition = (): [number, number, number] => {
    if (isMobile) return [0, -2, -0.32];
    if (isTablet) return [0, -3.25, -1];
    return [0, -4.25, -1.5];
  };

  return (
    <group
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
    >
      <hemisphereLight intensity={0.15} groundColor="black" />
      <spotLight position={[-100, 50, 10]} angle={0.12} penumbra={1} intensity={1} castShadow />
      <pointLight intensity={1} />
      <primitive
        object={scene}
        scale={getScale()}
        position={getPosition()}
        rotation={[-0.01, -0.2, -0.1]}
      />
    </group>
  );
};

const ComputersCanvas = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 500;
      const tablet = window.innerWidth <= 1024 && window.innerWidth > 500;
      setIsMobile(mobile);
      setIsTablet(tablet);
    };

    handleResize(); // Initial check
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <Canvas
      className="canvas-container"
      frameloop="demand"
      shadows
      dpr={[1, 2]}
      camera={{
        position: isMobile ? [15, 3, 5] : [20, 3, 5],
        fov: isMobile ? 35 : 25,
      }}
      gl={{ preserveDrawingBuffer: true }}
      style={{ cursor: isHovered ? (isDragging ? "grabbing" : "grab") : "auto" }}
    >
      <Suspense fallback={<CanvasLoader />}>
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          enableRotate={isHovered || isDragging}
          onStart={() => setIsDragging(true)}
          onEnd={() => setIsDragging(false)}
          maxPolarAngle={Math.PI / 2}
          minPolarAngle={Math.PI / 2}
        />
        <Computers isMobile={isMobile} isTablet={isTablet} setHovered={setIsHovered} />
      </Suspense>
      <Preload all />
    </Canvas>
  );
};

export default ComputersCanvas;