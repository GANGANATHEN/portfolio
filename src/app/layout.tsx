import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/wrapper/SmoothScroll";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#050816",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "Ganganathan | Full-Stack & Frontend Developer",
  description:
    "Official portfolio of Ganganathan — Frontend-focused Full-Stack Developer specializing in Next.js, React, TypeScript, Three.js, and scalable Node.js architectures.",
  keywords: [
    "Ganganathan",
    "Frontend Developer",
    "Full Stack Developer",
    "Next.js",
    "React",
    "Three.js",
    "GSAP",
    "TypeScript",
    "Portfolio",
    "Chennai Developer",
  ],
  authors: [{ name: "Ganganathan" }],
  creator: "Ganganathan",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://ganganathan.dev",
  ),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Ganganathan | Full-Stack & Frontend Developer",
    description:
      "Explore interactive 3D web experiences, performance-focused applications, and full-stack projects crafted by Ganganathan.",
    url: "/",
    siteName: "Ganganathan Portfolio",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/assets/herobg.png",
        width: 1200,
        height: 630,
        alt: "Ganganathan Developer Portfolio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ganganathan | Full-Stack & Frontend Developer",
    description:
      "Explore interactive 3D web experiences and full-stack projects crafted by Ganganathan.",
    images: ["/assets/herobg.png"],
  },
  icons: {
    icon: "/logog.svg",
    shortcut: "/logog.svg",
    apple: "/logog.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased no-scrollbar`}
    >
      <body className="min-h-full flex flex-col bg-primary text-white">
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
