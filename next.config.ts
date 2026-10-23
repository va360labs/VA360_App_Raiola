import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Single self-contained server for the Docker image (Coolify).
  output: "standalone",
  // Native module: keep it out of the bundle and load it from node_modules.
  serverExternalPackages: ["better-sqlite3"],
  poweredByHeader: false,
};

export default nextConfig;
