"use client";
import React, { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Preload, useGLTF } from "@react-three/drei";
import CanvasLoader from "../Loader";

const Earth = ({ setHovered }) => {
  const { scene } = useGLTF("/planet/scene.gltf");

  return (
    <group
      onPointerOver={(e) => {
        e.stopPropagation(); 
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <primitive object={scene} scale={2.5} position={[0, 0, 0]} rotation={[0, 0, 0]} />
    </group>
  );
};

const EarthCanvas = () => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  return (
    <Canvas
      shadows
      frameloop='demand'
      dpr={[1, 2]}
      gl={{ 
        preserveDrawingBuffer: true,
        failIfMajorPerformanceCaveat: false 
      }}
      camera={{
        fov: 45,
        near: 0.1,
        far: 200,
        position: [-4, 3, 6],
      }}
      
      style={{ cursor: isHovered ? (isDragging ? "grabbing" : "grab") : "auto" }}
    >
      <Suspense fallback={<CanvasLoader />}>
        <OrbitControls
          autoRotate
          enableZoom={false}
          maxPolarAngle={Math.PI / 2}
          minPolarAngle={Math.PI / 2}
          enableRotate={isHovered || isDragging} 
          onStart={() => setIsDragging(true)}
          onEnd={() => setIsDragging(false)} 
        />
        {/* State updater-a pass panrom */}
        <Earth setHovered={setIsHovered} />
        <Preload all />
      </Suspense>
    </Canvas>
  );
};

export default EarthCanvas;