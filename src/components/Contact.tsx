"use client";
import { useRef, useEffect } from "react";
import { useForm} from "@formspree/react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { EarthCanvas } from "./canvas";
import ParticleBackground from "./background/ParticleBackground";

const Contact = () => {
  const [state, handleSubmit, reset] = useForm("mgvwlylr");
  const containerRef = useRef(null);

  useEffect(() => {
    if (state.succeeded) {
      const timer = setTimeout(() => {
        reset(); 
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state.succeeded, reset]);

  useGSAP(() => {
    gsap.from(".contact-card", { y: 50, opacity: 0, duration: 1, ease: "power4.out" });
  }, { scope: containerRef });

  return (
    <section id="contact" ref={containerRef} className="min-h-screen z-10 py-24 px-6 relative overflow-hidden bg-[#020205]">
      <ParticleBackground />
      <div className="max-w-7xl mx-auto flex lg:flex-row flex-col-reverse gap-16 items-center">
        
        <div className="contact-card flex-[0.6] w-full bg-black-100/50 backdrop-blur-xl border border-white/5 p-8 md:p-12 rounded-4xl shadow-2xl relative overflow-hidden">
          
          {/* Status Overlay */}
          {state.succeeded && (
            <div className="absolute inset-0 z-20 bg-black-100/90 backdrop-blur-md flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
                <span className="text-3xl">✨</span>
              </div>
              <h3 className="text-white text-2xl font-bold">Magic Received!</h3>
              <p className="text-secondary mt-2">Resetting form...</p>
            </div>
          )}

          <p className="text-cyan-400 font-bold uppercase tracking-widest text-sm mb-2">Connect with me</p>
          <h3 className="text-white font-black text-4xl md:text-5xl mb-12">Let&apos;s build <span className="text-transparent bg-clip-text bg-linear-to-r from-cyan-400 to-accent">magic.</span></h3>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <input type="text" name="name" required placeholder="Name" className="bg-tertiary p-4 rounded-xl text-white border border-transparent focus:border-cyan-400 outline-none transition-all" />
              <input type="email" name="email" required placeholder="Email" className="bg-tertiary p-4 rounded-xl text-white border border-transparent focus:border-cyan-400 outline-none transition-all" />
            </div>
            <textarea name="message" required placeholder="Your message..." rows={5} className="bg-tertiary p-4 rounded-xl text-white border border-transparent focus:border-cyan-400 outline-none transition-all w-full" />
            
            {state.errors && <p className="text-red-400 text-sm">Something went wrong. Please try again.</p>}

            <button type="submit" disabled={state.submitting}
              className="w-full bg-linear-to-r from-cyan-500 to-accent text-white font-bold py-4 rounded-xl hover:scale-[1.02] transition-all active:scale-95 shadow-lg shadow-cyan-500/20">
              {state.submitting ? "Sending..." : "Send Message"}
            </button>
          </form>
        </div>

        <div className="flex-1 w-full h-75 sm:h-100 lg:h-150 relative">
          <div className="absolute inset-0 bg-linear-to-tr from-cyan-500/20 to-accent/20 blur-[150px] rounded-full animate-pulse" />
          <EarthCanvas />
        </div>
      </div>
    </section>
  );
};

export default Contact;