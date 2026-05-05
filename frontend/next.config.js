/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/uploads/**",
      },
      {
        protocol: "https",
        hostname: "*.onrender.com",
        pathname: "/uploads/**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination:
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/:path*",
      },
      {
        source: "/upload",
        destination:
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/upload",
      },
      {
        source: "/uploads/:path*",
        destination:
          process.env.NEXT_PUBLIC_API_URL ||
          "http://localhost:8000/uploads/:path*",
      },
      {
        source: "/subtypes/:path*",
        destination:
          process.env.NEXT_PUBLIC_API_URL ||
          "http://localhost:8000/subtypes/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
