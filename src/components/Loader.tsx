'use client';
import { Html, useProgress } from "@react-three/drei";

const CanvasLoader = () => {
  const { progress } = useProgress();

  return (
    <Html as="div" center>
      <div className="flex flex-col items-center justify-center">
        <span className="canvas-loader"></span>
        
        <p className="mt-10 text-[14px] font-extrabold text-[#F1F1F1]">
          {progress.toFixed(2)}%
        </p>
      </div>
    </Html>
  );
};

export default CanvasLoader;