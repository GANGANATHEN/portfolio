'use client';
import React from "react";
import Image from "next/image";
import { services } from "@/constants";

const ServiceCard = ({ title, icon }: { title: string; icon: any }) => (
  <div className="xs:w-[250px] w-fit transition-transform hover:scale-105 duration-300">
    <div className="w-full bg-gradient-to-r from-green-400 to-pink-500 p-[1px] rounded-[20px] shadow-lg">
      <div className="bg-tertiary rounded-[20px] py-5 px-12 min-h-[280px] flex justify-evenly items-center flex-col">
        <Image
          src={icon}
          alt={title}
          width={64}
          height={64}
          className="object-contain"
        />
        <h3 className="text-white text-[20px] font-bold text-center">
          {title}
        </h3>
      </div>
    </div>
  </div>
);

const About = () => {
  return (
    <section id="about" className="max-w-7xl mx-auto px-6 sm:px-16 py-16">
      <div>
        <p className="text-secondary text-[14px] uppercase tracking-wider">Introduction</p>
        <h2 className="text-white font-black md:text-[60px] sm:text-[50px] xs:text-[40px] text-[30px]">Overview.</h2>
      </div>

      <p className="mt-4 text-secondary text-[17px] max-w-3xl leading-[30px]">
        I'm a passionate software developer with a knack for creating engaging 
        and responsive web interfaces using HTML, CSS, Bootstrap, and Tailwind CSS. 
        I love working with JavaScript and React.js to bring interactivity and 
        life to web applications. On the backend, my experience with Java helps 
        me build strong, reliable systems. I enjoy turning ideas into functional, 
        beautiful software that users love.
      </p>

      <div className="mt-20 flex flex-wrap gap-10">
        {services.map((service, index) => (
          <ServiceCard key={service.title} {...service} />
        ))}
      </div>
    </section>
  );
};

export default About;