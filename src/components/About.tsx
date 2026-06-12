"use client";
import React, { useRef } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { services } from "@/constants";

gsap.registerPlugin(ScrollTrigger);

const ServiceCard = ({ title, icon, index }) => (
  // Added 'service-card' class for GSAP stagger targeting
  // w-full on mobile, fixed width on larger screens for perfect alignment
  <div className="service-card xs:w-[250px] w-full flex justify-center">
    <div className="w-full bg-gradient-to-r from-green-400 to-pink-500 p-[1px] rounded-[20px] shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 cursor-pointer">
      {/* Added 'group' for internal hover effects */}
      <div className="bg-tertiary rounded-[20px] py-5 px-12 min-h-[280px] flex justify-evenly items-center flex-col relative overflow-hidden group">
        <Image
          src={icon}
          alt={title}
          width={64}
          height={64}
          // Icon slightly scales up on card hover
          className="object-contain transform group-hover:scale-110 transition-transform duration-300"
        />
        <h3 className="text-white text-[20px] font-bold text-center mt-4">
          {title}
        </h3>
      </div>
    </div>
  </div>
);

const About = () => {
  const containerRef = useRef(null);

  useGSAP(() => {
    // Pro tip: Using a Timeline with ScrollTrigger for sequenced animations
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        start: "top 80%", // Triggers when top of section hits 80% of viewport
        toggleActions: "play none none reverse", // Plays on scroll down, reverses on scroll up
      }
    });

    // 1. Subtitle & Title Reveal
    tl.from(".about-heading", {
      y: 50,
      opacity: 0,
      duration: 0.8,
      stagger: 0.2,
      ease: "power3.out"
    })
    // 2. Paragraph Reveal
    .from(".about-text", {
      y: 30,
      opacity: 0,
      duration: 0.8,
      ease: "power3.out"
    }, "-=0.4") // Starts 0.4s before the previous animation ends
    // 3. Service Cards Stagger Pop-in
    .from(".service-card", {
      scale: 0.8,
      opacity: 0,
      duration: 0.6,
      stagger: 0.15,
      ease: "back.out(1.5)"
    }, "-=0.2");

  }, { scope: containerRef });

  return (
    <section id="about" ref={containerRef} className="max-w-7xl mx-auto px-6 sm:px-16 py-20">
      <div>
        <p className="about-heading text-secondary text-[14px] uppercase tracking-wider font-semibold">
          Introduction
        </p>
        <h2 className="about-heading text-white font-black md:text-[60px] sm:text-[50px] xs:text-[40px] text-[30px] mt-2">
          Overview.
        </h2>
      </div>

      <p className="about-text mt-6 text-secondary text-[17px] max-w-3xl leading-[30px]">
        I'm a passionate software developer with a knack for creating engaging 
        and responsive web interfaces using HTML, CSS, Bootstrap, and Tailwind CSS. 
        I love working with JavaScript and React.js to bring interactivity and 
        life to web applications. On the backend, my experience with Java helps 
        me build strong, reliable systems. I enjoy turning ideas into functional, 
        beautiful software that users love.
      </p>

      {/* Added justify-center so cards look perfect even when wrapping */}
      <div className="mt-20 flex flex-wrap justify-center gap-10">
        {services.map((service, index) => (
          <ServiceCard key={service.title} index={index} {...service} />
        ))}
      </div>
    </section>
  );
};

export default About;