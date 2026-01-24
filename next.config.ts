import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [new URL('https://pbs.twimg.com/profile_images/1988665005928009728/X8Idm6KE_400x400.jpg')]
  }
};

export default nextConfig;
