'use client';
import React from "react";
import Image from "next/image";
import { projects } from "@/constants";

// Namma direct-ah Tailwind classes use panrom
const ProjectCard = ({ index, name, description, tags, image, source_code_link, url }: any) => {
  return (
    <div className="bg-tertiary p-5 rounded-2xl sm:w-[355px] w-full transition-transform hover:scale-105 duration-300">
      <div className="relative w-full h-[230px]">
        <Image
          src={image}
          alt="project_image"
          fill
          className="object-cover rounded-2xl"
        />

        <div className="absolute inset-0 flex justify-end m-3">
          <div
            onClick={() => window.open(source_code_link, "_blank")}
            className="black-gradient w-10 h-10 rounded-full flex justify-center items-center cursor-pointer"
          >
            {/* Github icon path correct-ah irukanum */}
            <div className="text-white font-bold">Git</div>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-white font-bold text-[24px]">{name}</h3>
        <p className="mt-2 text-secondary text-[14px]">{description}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {tags.map((tag: any) => (
          <p key={tag.name} className={`text-[14px] ${tag.color}`}>
            #{tag.name}
          </p>
        ))}
      </div>

      <div className="w-full text-center mt-6 mb-2">
        <a href={url} target="_blank" className="text-white font-bold text-[16px] p-3 bg-black rounded-[12px] hover:bg-slate-800 transition-colors">
          View Website
        </a>
      </div>
    </div>
  );
};

const Works = () => {
  return (
    <section id="work" className="max-w-7xl mx-auto px-6 sm:px-16 py-16">
      <div>
        <p className="text-secondary text-[14px] uppercase tracking-wider">My work</p>
        <h2 className="text-white font-black md:text-[60px] sm:text-[50px] xs:text-[40px] text-[30px]">Projects.</h2>
      </div>

      <div className="w-full flex">
        <p className="mt-3 text-secondary text-[17px] max-w-3xl leading-[30px]">
          Following projects showcases my skills and experience through real-world examples.
        </p>
      </div>

      <div className="mt-20 flex flex-wrap gap-7">
        {projects.map((project, index) => (
          <ProjectCard key={`project-${index}`} index={index} {...project} />
        ))}
      </div>
    </section>
  );
};

export default Works;