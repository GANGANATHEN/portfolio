"use client";
import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Preload, useGLTF } from "@react-three/drei";
import CanvasLoader from "../Loader";

const Computers = ({ isMobile, setHovered }) => {
  const { scene } = useGLTF("/desktop_pc/scene.gltf");

  return (
    <group
      
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      
      onPointerOut={() => setHovered(false)}
    >
      <hemisphereLight intensity={0.15} groundColor="black" />
      <spotLight
        position={[-100, 50, 10]}
        angle={0.12}
        penumbra={1}
        intensity={1}
        castShadow
      />
      <pointLight intensity={1} />
      <primitive
        object={scene}
        scale={isMobile ? 0.7 : 0.8}
        position={isMobile ? [0, -3, -2.2] : [0, -4.25, -1.5]}
        rotation={[-0.01, -0.2, -0.1]}
      />
    </group>
  );
};

const ComputersCanvas = () => {
  const [isMobile, setIsMobile] = useState(false);
  
  // 2. Hover & Drag states track panrom
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 500px)");
    const checkMobile = () => { setIsMobile(mediaQuery.matches); };
    
    checkMobile();
    mediaQuery.addEventListener("change", checkMobile);
    return () => { mediaQuery.removeEventListener("change", checkMobile); };
  }, []);

  return (
    <Canvas
      className="canvas-container"
      frameloop="demand"
      shadows
      dpr={[1, 2]}
      camera={{ position: [20, 3, 5], fov: 25 }}
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
        {/* State updater-a pass panrom */}
        <Computers isMobile={isMobile} setHovered={setIsHovered} />
      </Suspense>
      <Preload all />
    </Canvas>
  );
};

export default ComputersCanvas;