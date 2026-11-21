import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    // Progress photos and lab PDFs are uploaded through server actions.
    serverActions: { bodySizeLimit: "50mb" },
  },
};

export default nextConfig;
