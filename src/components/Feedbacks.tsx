'use client';
import React, { useRef } from "react";
import Image from "next/image";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { testimonials } from "@/constants";

gsap.registerPlugin(ScrollTrigger);

type FeedbackCardProps = {
  testimonial: string;
  name: string;
  designation: string;
  company: string;
  image: string;
};

const FeedbackCard: React.FC<FeedbackCardProps> = ({ testimonial, name, designation, company, image }) => (
  <div className="feedback-card bg-black-200 p-10 rounded-3xl xs:w-[310px] w-full shadow-lg">
    <p className="text-white font-black text-[48px]">"</p>
    <div className="mt-1">
      <p className="text-white tracking-wider text-[18px]">{testimonial}</p>
      <div className="mt-7 flex justify-between items-center gap-1">
        <div className="flex-1 flex flex-col">
          <p className="text-white font-medium text-[16px]">
            <span className="text-accent">@</span> {name}
          </p>
          <p className="mt-1 text-secondary text-[12px]">
            {designation} of {company}
          </p>
        </div>
        <Image
          src={image}
          alt={`feedback_by-${name}`}
          width={40}
          height={40}
          className="rounded-full object-cover"
        />
      </div>
    </div>
  </div>
);

const Feedbacks = () => {
  const containerRef = useRef(null);

  useGSAP(() => {
    gsap.from(".feedback-card", {
      opacity: 0,
      y: 50,
      duration: 1,
      stagger: 0.2,
      scrollTrigger: {
        trigger: ".feedbacks-container",
        start: "top 80%",
      },
    });
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="mt-12 bg-black-100 rounded-[20px]">
      <div className="bg-tertiary rounded-2xl px-6 sm:px-16 py-16 min-h-[300px]">
        <p className="text-secondary text-[14px] uppercase tracking-wider">What others say</p>
        <h2 className="text-white font-black md:text-[60px] sm:text-[50px] xs:text-[40px] text-[30px]">Mythic figures.</h2>
      </div>
      
      <div className="feedbacks-container -mt-20 pb-14 px-6 sm:px-16 flex flex-wrap gap-6">
        {testimonials.map((t, index) => (
          <FeedbackCard key={index} {...t} />
        ))}
      </div>
    </div>
  );
};

export default Feedbacks;