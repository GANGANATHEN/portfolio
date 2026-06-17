import type { NextConfig } from "next";

const nextConfig: NextConfig & { allowedDevOrigins?: string[]; eslint?: { ignoreDuringBuilds?: boolean } } = {
  reactCompiler: true,
  allowedDevOrigins: ["10.20.120.107"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "randomuser.me",
        port: "",
        pathname: "/api/portraits/**",
      },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;