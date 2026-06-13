'use client';
import { BallCanvas } from "./canvas";
import { technologies } from "@/constants";

const Tech = () => {
  return (
    <section className="max-w-7xl mx-auto px-6 sm:px-16 py-16">
      <div className="flex flex-row flex-wrap justify-center gap-10">
        {technologies.map((technology) => (
          <div className="w-28 h-28" key={technology.name}>
            {/* 3D Ball Canvas */}
            <BallCanvas icon={technology.icon.src} />
          </div>
        ))}
      </div>
    </section>
  );
};

export default Tech;