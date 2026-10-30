"use client";
import React, { useRef, useEffect } from "react";
import { useForm } from "@formspree/react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { EarthCanvas } from "./canvas";
import ParticleBackground from "./background/ParticleBackground";

const Contact = () => {
  const [state, handleSubmit, reset] = useForm("mgvwlylr");
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (state.succeeded) {
      const timer = setTimeout(() => {
        reset();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [state.succeeded, reset]);

  useGSAP(
    () => {
      gsap.from(".contact-card", {
        y: 40,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
      });
    },
    { scope: containerRef },
  );

  return (
    <section
      id="contact"
      ref={containerRef}
      className="relative z-10 py-16 sm:py-24 px-3 sm:px-6 md:px-10 bg-[#020205] overflow-x-hidden min-h-screen flex items-center justify-center scroll-mt-24"
    >
      <ParticleBackground />
      <div className="max-w-7xl w-full mx-auto flex lg:flex-row flex-col-reverse gap-8 sm:gap-12 lg:gap-16 items-center">
        {/* Contact Form Card */}
        <div className="contact-card flex-[0.6] w-full bg-black-100/50 backdrop-blur-xl border border-white/5 p-5 sm:p-8 md:p-12 rounded-3xl sm:rounded-4xl shadow-2xl relative overflow-hidden">
          {/* Status Overlay */}
          {state.succeeded && (
            <div className="absolute inset-0 z-20 bg-black-100/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mb-4 sm:mb-6 animate-pulse">
                <span className="text-2xl sm:text-3xl">✨</span>
              </div>
              <h3 className="text-white text-xl sm:text-2xl font-bold">
                Magic Received!
              </h3>
              <p className="text-secondary text-xs sm:text-sm mt-2">
                Thank you for reaching out. I will get back to you shortly.
              </p>
            </div>
          )}

          <p className="text-cyan-400 font-bold uppercase tracking-widest text-xs sm:text-sm mb-2">
            Connect with me
          </p>
          <h3 className="text-white font-black text-3xl sm:text-4xl md:text-5xl mb-6 sm:mb-10 leading-tight">
            Let&apos;s build{" "}
            <span className="text-transparent bg-clip-text bg-linear-to-r from-cyan-400 to-accent">
              magic.
            </span>
          </h3>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label htmlFor="contact-name" className="sr-only">Your Name</label>
                <input
                  id="contact-name"
                  type="text"
                  name="name"
                  required
                  placeholder="Your Name"
                  aria-label="Your Name"
                  className="w-full bg-tertiary p-3.5 sm:p-4 rounded-xl text-white text-sm sm:text-base border border-transparent focus:border-cyan-400 outline-none transition-all placeholder:text-gray-500"
                />
              </div>
              <div>
                <label htmlFor="contact-email" className="sr-only">Your Email</label>
                <input
                  id="contact-email"
                  type="email"
                  name="email"
                  required
                  placeholder="Your Email"
                  aria-label="Your Email"
                  className="w-full bg-tertiary p-3.5 sm:p-4 rounded-xl text-white text-sm sm:text-base border border-transparent focus:border-cyan-400 outline-none transition-all placeholder:text-gray-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="contact-message" className="sr-only">Your Message</label>
              <textarea
                id="contact-message"
                name="message"
                required
                placeholder="Your message..."
                aria-label="Your Message"
                rows={5}
                className="bg-tertiary p-3.5 sm:p-4 rounded-xl text-white text-sm sm:text-base border border-transparent focus:border-cyan-400 outline-none transition-all w-full placeholder:text-gray-500"
              />
            </div>

            {state.errors && (
              <p className="text-red-400 text-xs sm:text-sm">
                Something went wrong. Please check your inputs and try again.
              </p>
            )}

            <button
              type="submit"
              disabled={state.submitting}
              className="w-full bg-linear-to-r from-cyan-500 to-accent text-white font-bold py-3.5 sm:py-4 rounded-xl hover:scale-[1.01] transition-all active:scale-95 shadow-lg shadow-cyan-500/20 text-sm sm:text-base cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {state.submitting ? "Sending..." : "Send Message"}
            </button>
          </form>
        </div>

        {/* 3D Earth Globe Visualization */}
        <div className="lg:flex-1 w-full h-64 sm:h-80 md:h-110 lg:h-130 xl:h-150 relative overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 bg-linear-to-tr from-cyan-500/15 to-accent/15 blur-[100px] rounded-full pointer-events-none" />
          <EarthCanvas />
        </div>
      </div>
    </section>
  );
};

export default Contact;
