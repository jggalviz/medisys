import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/santa-ines",
        destination: "/clinica-demo",
        statusCode: 301, // Redirección permanente
      },
      {
        source: "/santa-ines/admin",
        destination: "/clinica-demo/admin",
        statusCode: 301,
      },
    ];
  },
};

export default nextConfig;
