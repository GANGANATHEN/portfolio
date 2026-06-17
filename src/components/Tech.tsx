'use client';
import { BallCanvas } from "./canvas";
import { technologies } from "@/constants";

const Tech = () => {
  return (
    <section className="padding py-16">
      <div className="flex flex-row flex-wrap justify-center gap-10">
        {technologies.map((technology) => (
          <div className="w-22 h-22 sm:w-28 sm:h-28 2xl:w-32 2xl:h-32 cursor-grab active:cursor-grabbing" key={technology.name}>
            {/* 3D Ball Canvas */}
            <BallCanvas icon={technology.icon.src} />
          </div>
        ))}
      </div>
    </section>
  );
};

export default Tech;