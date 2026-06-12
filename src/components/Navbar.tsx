"use client";
import React, { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { navLinks } from "@/constants";
import { logo, menu, close } from "../../public/assets";

gsap.registerPlugin(ScrollTrigger);

const Navbar = () => {
  const [active, setActive] = useState("");
  const [toggle, setToggle] = useState(false);
  const containerRef = useRef(null);
  const innerNavRef = useRef(null);

  useGSAP(() => {
    // 1. Pre-calculate values to prevent the first-scroll lag
    gsap.set(innerNavRef.current, { 
      width: "100%", 
      maxWidth: "100%", 
      y: 0, 
      borderRadius: "0px" 
    });

    // 2. Initial Page Load Animation
    gsap.from(containerRef.current, { 
      y: -100, 
      opacity: 0, 
      duration: 1, 
      ease: "power4.out" 
    });
    
    gsap.from(".nav-item", { 
      y: -20, 
      opacity: 0, 
      stagger: 0.1, 
      duration: 0.8, 
      delay: 0.3, 
      ease: "back.out(1.7)" 
    });

    // 3. Dynamic Island Scroll Animation
    ScrollTrigger.create({
      trigger: "body",
      start: "top -50px",
      onEnter: () => {
        innerNavRef.current.classList.add("active-glass");
        
        gsap.to(innerNavRef.current, {
          width: "80%",
          maxWidth: "900px",
          y: 20, 
          borderRadius: "50px",
          duration: 0.4, 
          ease: "power2.out",
          overwrite: "auto" 
        });
      },
      onLeaveBack: () => {
        innerNavRef.current.classList.remove("active-glass");
        
        gsap.to(innerNavRef.current, {
          width: "100%",
          maxWidth: "100%",
          y: 0, 
          borderRadius: "0px",
          duration: 0.4,
          ease: "power2.out",
          overwrite: "auto" 
        });
      },
    });
  }, { scope: containerRef });

  // Magnetic Hover Logic
  const handleMagneticMove = (e) => {
    const el = e.currentTarget;
    const boundingRect = el.getBoundingClientRect();
    const x = e.clientX - boundingRect.left - boundingRect.width / 2;
    const y = e.clientY - boundingRect.top - boundingRect.height / 2;
    gsap.to(el, { x: x * 0.4, y: y * 0.4, duration: 0.3, ease: "power2.out", overwrite: "auto" });
  };

  const handleMagneticLeave = (e) => {
    gsap.to(e.currentTarget, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.3)", overwrite: "auto" });
  };

  return (
    <nav ref={containerRef} className="w-full fixed top-0 z-50 flex justify-center pointer-events-none">
      <div 
        ref={innerNavRef}
        className="nav-island-container w-full flex justify-between items-center px-6 md:px-12 py-5 pointer-events-auto"
      >
        <Link
          href="/"
          className="flex items-center gap-3 nav-item"
          onClick={() => { setActive(""); window.scrollTo(0, 0); }}
        >
          <Image src={logo} alt="logo" width={40} height={40} className="object-contain" />
          <p className="text-white text-[18px] font-extrabold tracking-wide cursor-pointer flex">
            Ganganathan <span className="sm:block hidden text-indigo-500 ml-2">. DEV</span>
          </p>
        </Link>

        {/* Desktop Links */}
        <ul className="list-none hidden sm:flex flex-row gap-8 items-center">
          {navLinks.map((nav) => (
            <li
              key={nav.id}
              onMouseMove={handleMagneticMove}
              onMouseLeave={handleMagneticLeave}
              className={`magnetic-link nav-item relative px-3 py-2 rounded-full cursor-pointer text-[16px] font-semibold tracking-wide transition-colors duration-300 ${
                active === nav.title ? "text-white bg-white/20" : "text-gray-300 hover:text-white"
              }`}
              onClick={() => setActive(nav.title)}
            >
              <a href={`#${nav.id}`}>{nav.title}</a>
            </li>
          ))}
        </ul>

        {/* Mobile Menu */}
        <div className="sm:hidden flex flex-1 justify-end items-center nav-item">
          <Image
            src={toggle ? close : menu} alt="menu" width={28} height={28}
            className="object-contain cursor-pointer" onClick={() => setToggle(!toggle)}
          />

          <div
            className={`${!toggle ? "hidden" : "flex"} nav-island-container active-glass p-6 absolute top-20 right-0 mx-4 my-2 min-w-[140px] z-10 rounded-2xl`}
          >
            <ul className="list-none flex justify-end items-start flex-col gap-4">
              {navLinks.map((nav) => (
                <li
                  key={nav.id}
                  className={`font-poppins font-medium cursor-pointer text-[16px] ${active === nav.title ? "text-white" : "text-secondary"}`}
                  onClick={() => { setToggle(!toggle); setActive(nav.title); }}
                >
                  <a href={`#${nav.id}`}>{nav.title}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;