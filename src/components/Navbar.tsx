"use client";
import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { navLinks } from "@/constants";
import { logo, menu, close } from "../../public/assets";
import WaterDropletsOverlay from "./WaterDropletsOverlay";

gsap.registerPlugin(ScrollTrigger);

const Navbar = () => {
  const [active, setActive] = useState("Home");
  const [toggle, setToggle] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const innerNavRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      gsap.set(innerNavRef.current, {
        width: "100%",
        maxWidth: "100%",
        y: 0,
        borderRadius: "0px",
      });

      gsap.from(containerRef.current, {
        y: -100,
        opacity: 0,
        duration: 1,
        ease: "power4.out",
      });

      gsap.from(".nav-item", {
        y: -20,
        opacity: 0,
        stagger: 0.08,
        duration: 0.8,
        delay: 0.25,
        ease: "back.out(1.7)",
      });

      ScrollTrigger.create({
        trigger: "body",
        start: "top -50px",
        onEnter: () => {
          if (innerNavRef.current) {
            innerNavRef.current.classList.add("active-glass");
            const isSmall = window.innerWidth <= 640;

            gsap.to(innerNavRef.current, {
              width: isSmall ? "94%" : "88%",
              maxWidth: "1100px",
              y: isSmall ? 8 : 16,
              borderRadius: "50px",
              duration: 0.4,
              ease: "power2.out",
              overwrite: "auto",
            });
          }
        },
        onLeaveBack: () => {
          if (innerNavRef.current) {
            innerNavRef.current.classList.remove("active-glass");

            gsap.to(innerNavRef.current, {
              width: "100%",
              maxWidth: "100%",
              y: 0,
              borderRadius: "0px",
              duration: 0.4,
              ease: "power2.out",
              overwrite: "auto",
            });
          }
        },
      });
    },
    { scope: containerRef },
  );

  // Active section tracking on scroll
  useEffect(() => {
    const sectionIds = navLinks.map((l) => l.id);
    const handleScroll = () => {
      const scrollY = window.scrollY;
      if (scrollY < 120) {
        setActive("Home");
        return;
      }
      for (let i = sectionIds.length - 1; i >= 0; i--) {
        const id = sectionIds[i];
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 180) {
            const currentNav = navLinks.find((l) => l.id === id);
            if (currentNav) setActive(currentNav.title);
            break;
          }
        }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && toggle) {
        setToggle(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  // Close mobile menu on outside click
  useEffect(() => {
    if (!toggle) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setToggle(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [toggle]);

  // Smooth Section Navigation
  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string, title: string) => {
    e.preventDefault();
    setActive(title);
    setToggle(false);

    if (id === "home") {
      if (typeof window !== "undefined") {
        const globalLenis = (window as unknown as { __lenis?: { scrollTo: (target: number | HTMLElement, opts?: unknown) => void } }).__lenis;
        if (globalLenis) {
          globalLenis.scrollTo(0);
        } else {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        window.history.pushState(null, "", "/");
      }
      return;
    }

    const target = document.getElementById(id);
    if (target) {
      const globalLenis = (window as unknown as { __lenis?: { scrollTo: (target: number | HTMLElement, opts?: unknown) => void } }).__lenis;
      if (globalLenis) {
        globalLenis.scrollTo(target, { offset: -90 });
      } else {
        const navHeight = 90;
        const elementPosition = target.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - navHeight;
        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth",
        });
      }
      window.history.pushState(null, "", `#${id}`);
    }
  };

  // Magnetic Hover Logic for Desktop Navigation Items
  const handleMagneticMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget as HTMLElement;
    const boundingRect = el.getBoundingClientRect();
    const x = e.clientX - boundingRect.left - boundingRect.width / 2;
    const y = e.clientY - boundingRect.top - boundingRect.height / 2;
    gsap.to(el, {
      x: x * 0.35,
      y: y * 0.35,
      duration: 0.3,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  const handleMagneticLeave = (e: React.MouseEvent<HTMLElement>) => {
    gsap.to(e.currentTarget as HTMLElement, {
      x: 0,
      y: 0,
      duration: 0.6,
      ease: "elastic.out(1, 0.4)",
      overwrite: "auto",
    });
  };

  return (
    <nav
      ref={containerRef}
      className="w-full flex justify-center pointer-events-none select-none"
    >
      <div
        ref={innerNavRef}
        className="nav-island-container mt-2 w-full flex justify-between items-center px-3.5 sm:px-6 md:px-8 lg:px-10 py-2 sm:py-2.5 pointer-events-auto overflow-hidden relative"
      >
        {/* Layer 1: Subtle Caustic Background Light Reflection */}
        <div className="liquid-glass-reflection" />

        {/* Layer 2: Light Refraction Sheen Streak */}
        <div className="liquid-glass-sheen" />

        {/* Layer 3: Physically Realistic Scattered Water Droplets */}
        <WaterDropletsOverlay className="opacity-80" />

        {/* Brand Logo & Name */}
        <Link
          href="/"
          className="flex items-center gap-2 sm:gap-3 nav-item z-10 shrink-0"
          onClick={(e) => handleNavClick(e, "home", "Home")}
        >
          <Image
            src={logo}
            alt="logo"
            width={34}
            height={34}
            className="object-contain sm:w-9 sm:h-9"
          />
          <p className="text-white text-[15px] sm:text-[17px] font-extrabold tracking-wide cursor-pointer flex items-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            GANGANATHAN{" "}
            <span className="sm:block hidden text-accent ml-2 text-xs font-mono font-bold tracking-widest">
              .DEV
            </span>
          </p>
        </Link>

        {/* Desktop / Tablet Links (md: >= 768px) */}
        <ul className="list-none hidden md:flex flex-row items-center gap-1.5 md:gap-2 lg:gap-4 xl:gap-6 z-10">
          {navLinks.map((nav) => {
            const isCurrent = active.toLowerCase() === nav.title.toLowerCase();
            return (
              <li
                key={nav.id}
                onMouseMove={handleMagneticMove}
                onMouseLeave={handleMagneticLeave}
                className={`magnetic-link nav-item relative rounded-full transition-all duration-300 ${
                  isCurrent
                    ? "bg-white/15 text-white shadow-xs shadow-cyan-400/20 border border-white/20"
                    : "text-gray-300 hover:text-white hover:bg-white/5"
                }`}
              >
                <a
                  href={`#${nav.id}`}
                  onClick={(e) => handleNavClick(e, nav.id, nav.title)}
                  className="block px-2.5 py-1.5 md:px-3 md:py-1.5 lg:px-3.5 lg:py-2 text-xs md:text-[13px] lg:text-[14px] xl:text-[15px] font-semibold tracking-wide whitespace-nowrap drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
                >
                  {nav.title}
                </a>
              </li>
            );
          })}
        </ul>

        {/* Mobile Hamburger Button (< 768px) */}
        <div className="md:hidden flex flex-1 justify-end items-center nav-item z-20">
          <button
            type="button"
            aria-label="Toggle Navigation Menu"
            aria-expanded={toggle}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-colors"
            onClick={() => setToggle(!toggle)}
          >
            <Image
              src={toggle ? close : menu}
              alt="menu"
              width={24}
              height={24}
              className="object-contain"
            />
          </button>

          {/* Mobile Dropdown Menu with Liquid Glass styling */}
          {toggle && (
            <div
              ref={mobileMenuRef}
              className="absolute top-16 right-0 mx-3 min-w-56 sm:min-w-64 max-w-[calc(100vw-1.5rem)] z-50 rounded-2xl p-4 bg-[#0a0f1d]/90 backdrop-blur-2xl border border-white/15 shadow-2xl shadow-black/80 animate-in fade-in slide-in-from-top-3 duration-200"
            >
              <div className="relative">
                {/* Subtle mobile droplet overlay */}
                <div className="liquid-glass-sheen" />
                <ul className="list-none flex flex-col gap-1 w-full relative z-10">
                  {navLinks.map((nav) => {
                    const isCurrent = active.toLowerCase() === nav.title.toLowerCase();
                    return (
                      <li
                        key={nav.id}
                        className={`w-full rounded-xl transition-colors ${
                          isCurrent
                            ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30"
                            : "text-gray-300 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        <a
                          href={`#${nav.id}`}
                          onClick={(e) => handleNavClick(e, nav.id, nav.title)}
                          className="flex items-center justify-between w-full px-3.5 py-2.5 text-sm font-medium"
                        >
                          <span>{nav.title}</span>
                          {isCurrent && (
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                          )}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
