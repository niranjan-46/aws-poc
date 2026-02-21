import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendInternalUrl =
  process.env.BACKEND_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8080";
const normalizedBackendInternalUrl = backendInternalUrl.replace(/\/$/, "");
const workspaceRoot = path.join(__dirname, "..", "..");

/** @type {import("next").NextConfig} */
const nextConfig = {
  outputFileTracingRoot: workspaceRoot,
  turbopack: {
    root: workspaceRoot,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${normalizedBackendInternalUrl}/api/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.dsedify.com",
        pathname: "/_next/image",
      },
    ],
  },
};

export default nextConfig;
