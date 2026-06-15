"use client";
import React, { useState, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import Image from "next/image";

const Feedbacks = () => {
  const containerRef = useRef(null);
  const [feedbacks, setFeedbacks] = useState([
    {
      testimonial: "The performance is top notch, highly recommended!",
      name: "Arun",
      designation: "Dev",
      company: "Google",
      image: "https://randomuser.me/api/portraits/men/10.jpg",
    },
  ]);
  const [form, setForm] = useState({ name: "", testimonial: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newFeedback = {
      ...form,
      designation: "Community",
      company: "User",
      image: "https://randomuser.me/api/portraits/lego/1.jpg",
    };
    setFeedbacks([newFeedback, ...feedbacks]);
    setForm({ name: "", testimonial: "" });
  };

  useGSAP(
    () => {
      gsap.from(".feedback-card", {
        opacity: 0,
        y: 10,
        duration: 0.4,
        stagger: 0.05,
        ease: "power2.out",
      });
    },
    { scope: containerRef, dependencies: [feedbacks] },
  );

  return (
    <section ref={containerRef} className=" p-6 md:p-10 bg-primary">
      {/* Header */}
      <h2 className="text-white text-2xl font-semibold mb-6 flex items-center gap-2">
        <span className="text-accent">{feedbacks.length}</span> Comments
      </h2>

      {/* Input Box (YouTube/Playstore style) */}
      <form onSubmit={handleSubmit} className="flex gap-4 mb-10 items-start">
        <img
          src="https://randomuser.me/api/portraits/lego/2.jpg"
          className="w-10 h-10 rounded-full mt-1"
          alt="You"
        />
        <div className="flex-1 flex flex-col gap-2">
          <input
            placeholder="Add a public comment..."
            className="bg-transparent border-b border-gray-600 focus:border-accent outline-none text-white pb-1 transition-colors"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            placeholder="Your thoughts..."
            className="bg-transparent border-b border-gray-600 focus:border-accent outline-none text-white pb-1 transition-colors"
            value={form.testimonial}
            onChange={(e) => setForm({ ...form, testimonial: e.target.value })}
          />
          <div className="flex justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={() => setForm({ name: "", testimonial: "" })}
              className="text-gray-400 hover:text-white text-sm font-bold"
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="bg-gray-700 hover:bg-accent text-white px-4 py-1.5 rounded-full text-sm font-bold transition-all"
            >
              COMMENT
            </button>
          </div>
        </div>
      </form>

      {/* Feedbacks List */}
      <div className="flex flex-col gap-8">
        {feedbacks.map((f, i) => (
          <div key={i} className="feedback-card flex gap-4">
            <Image
              src={f.image}
              alt={f.name}
              width={100}
              height={100}
              className="w-10 h-10 rounded-full"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-white font-bold text-sm">@{f.name}</span>
                <span className="text-gray-500 text-xs">just now</span>
              </div>
              <p className="text-gray-200 text-sm leading-relaxed">
                {f.testimonial}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Feedbacks;
