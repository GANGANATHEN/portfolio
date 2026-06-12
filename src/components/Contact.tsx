"use client";
import React, { useRef } from "react";
import { useForm, ValidationError } from "@formspree/react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { EarthCanvas } from "./canvas";

const Contact = () => {
  const [state, handleSubmit] = useForm("mgvwlylr");
  const containerRef = useRef(null);

  // GSAP Animation
  useGSAP(
    () => {
      gsap.from(".contact-form", {
        x: -100,
        opacity: 0,
        duration: 1,
        ease: "power2.out",
      });
      gsap.from(".earth-canvas", {
        x: 100,
        opacity: 0,
        duration: 1,
        ease: "power2.out",
      });
    },
    { scope: containerRef },
  );

  if (state.succeeded) {
    return (
      <div className="xl:mt-12 flex flex-col gap-10 overflow-hidden max-w-7xl mx-auto py-16 px-6 relative z-0">
        <p className="text-center text-white text-[20px]">
          Thanks for sending Message...!
        </p>
        <div className="h-[350px] md:h-[550px]">
          <EarthCanvas />
        </div>
      </div>
    );
  }

  return (
    <div
      id="contact"
      ref={containerRef}
      className="xl:mt-12 flex xl:flex-row flex-col-reverse gap-10 overflow-hidden max-w-7xl mx-auto py-16 px-6 relative z-0"
    >
      {/* GSAP Target: contact-form */}
      <div className="contact-form flex-[0.5] bg-black-100 p-8 rounded-2xl">
        <p className="text-secondary text-[14px] uppercase tracking-wider">
          Get in touch
        </p>
        <h3 className="text-white font-black md:text-[60px] sm:text-[50px] xs:text-[40px] text-[30px]">
          Contact.
        </h3>

        <form onSubmit={handleSubmit} className="mt-12 flex flex-col gap-8">
          <label className="flex flex-col">
            <span className="text-white font-medium mb-4">Your Name</span>
            <input
              type="text"
              name="name"
              required
              placeholder="What's your good name?"
              className="bg-tertiary py-4 px-6 placeholder:text-secondary text-white rounded-lg outline-none border-none font-medium"
            />
          </label>

          <label className="flex flex-col">
            <span className="text-white font-medium mb-4">Your email</span>
            <input
              id="email"
              type="email"
              name="email"
              required
              placeholder="What's your email address?"
              className="bg-tertiary py-4 px-6 placeholder:text-secondary text-white rounded-lg outline-none border-none font-medium"
            />
            <ValidationError
              prefix="Email"
              field="email"
              errors={state.errors}
            />
          </label>

          <label className="flex flex-col">
            <span className="text-white font-medium mb-4">Your Message</span>
            <textarea
              rows={7}
              id="message"
              name="message"
              required
              placeholder="What you want to say?"
              className="bg-tertiary py-4 px-6 placeholder:text-secondary text-white rounded-lg outline-none border-none font-medium"
            />
            <ValidationError
              prefix="Message"
              field="message"
              errors={state.errors}
            />
          </label>

          <button
            type="submit"
            disabled={state.submitting}
            className="bg-tertiary py-3 px-8 rounded-xl outline-none w-fit text-white font-bold shadow-md shadow-primary hover:bg-white hover:text-black transition-colors"
          >
            {state.submitting ? "Sending..." : "Send"}
          </button>
        </form>
      </div>

      {/* GSAP Target: earth-canvas */}
      <div className="earth-canvas xl:flex-1 xl:h-auto md:h-[550px] h-[350px]">
        <EarthCanvas />
      </div>
    </div>
  );
};

export default Contact;
