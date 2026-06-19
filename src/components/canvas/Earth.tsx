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
      {/* Dynamic scale based on device */}
      <primitive
        object={scene}
        scale={isMobile ? 5.4 : 2.5}
        position={[0, 0, 0]}
        rotation={[0, 0, 0]}
      />
    </group>
  );
};

const EarthCanvas = () => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 500px)").matches
      : false,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 500px)");

    const handleChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return (
    <Canvas
      shadows
      frameloop="demand"
      dpr={[1, 2]}
      gl={{ preserveDrawingBuffer: true }}
      camera={{
        fov: isMobile ? 55 : 45, // Wider FOV for mobile
        near: 0.1,
        far: 200,
        position: isMobile ? [-6, 3, 8] : [-4, 3, 6], // Adjust camera distance
      }}
      style={{
        width: "100%",
        height: "100%",
        cursor: isHovered ? (isDragging ? "grabbing" : "grab") : "auto",
      }}
    >
      <Suspense fallback={<CanvasLoader />}>
        {/* <OrbitControls
          autoRotate
          enableZoom={false}
          maxPolarAngle={Math.PI / 2}
          minPolarAngle={Math.PI / 2}
          enableRotate={isHovered || isDragging}
          onStart={() => setIsDragging(true)}
          onEnd={() => setIsDragging(false)}
        /> */}
        <OrbitControls enabled={false} />
        <Earth setHovered={setIsHovered} isMobile={isMobile} />
        <Preload all />
      </Suspense>
    </Canvas>
  );
};

export default EarthCanvas;
