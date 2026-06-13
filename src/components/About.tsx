"use client";
import { useRef } from "react";
import Image, { type StaticImageData } from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { services } from "@/constants";

gsap.registerPlugin(ScrollTrigger);

type ServiceCardProps = {
  title: string;
  icon: StaticImageData | string;
};

const ServiceCard = ({ title, icon }: ServiceCardProps) => (
  <div className="service-card xs:w-[250px] w-full flex justify-center">
    <div className="w-full bg-linear-to-r from-green-400 to-pink-500 p-px rounded-[20px] shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 cursor-pointer">
      
      <div className="bg-tertiary rounded-[20px] py-5 px-12 min-h-[280px] flex justify-evenly items-center flex-col relative overflow-hidden group">
        <Image
          src={icon}
          alt={title}
          width={64}
          height={64}
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

  useGSAP(
    () => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 80%", 
          toggleActions: "play none none reverse", 
        },
      });


      tl.from(".about-heading", {
        y: 50,
        opacity: 0,
        duration: 0.8,
        stagger: 0.2,
        ease: "power3.out",
      })

        .from(
          ".about-text",
          {
            y: 30,
            opacity: 0,
            duration: 0.8,
            ease: "power3.out",
          },
          "-=0.4",
        ) 
        .from(
          ".service-card",
          {
            scale: 0.8,
            opacity: 0,
            duration: 0.6,
            stagger: 0.15,
            ease: "back.out(1.5)",
          },
          "-=0.2",
        );
    },
    { scope: containerRef },
  );

  return (
    <section id="about" ref={containerRef} className="padding py-20">
      <div>
        <p className="about-heading text-secondary text-[14px] uppercase tracking-wider font-semibold">
          Introduction
        </p>
        <h2 className="about-heading text-white font-black md:text-[60px] sm:text-[50px] xs:text-[40px] text-[30px] mt-2">
          Overview.
        </h2>
      </div>

      <p className="about-text mt-6 text-secondary text-[17px] leading-[30px]">
        I am a{" "}
        <span className="text-white font-semibold">Full-Stack Developer</span>{" "}
        who loves building seamless, high-performance web applications. My
        expertise is rooted in
        <span className="text-white font-semibold"> Next.js</span> and{" "}
        <span className="text-white font-semibold">TypeScript</span>, which I
        use to craft polished, responsive user interfaces.
        <br className="hidden sm:block mt-2" />
        On the server side, I specialize in{" "}
        <span className="text-white font-semibold">Node.js</span> and
        <span className="text-white font-semibold"> Express.js</span>,
        architecting efficient APIs and managing data with{" "}
        <span className="text-white font-semibold">MongoDB</span>. I&apos;m
        passionate about writing clean, maintainable code and solving complex
        problems to create user-centric digital experiences.
      </p>

      {/*  grid container */}
      <div className="mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 justify-items-center">
        {services.map((service) => (
          <ServiceCard key={service.title} {...service} />
        ))}
      </div>
    </section>
  );
};

export default About;