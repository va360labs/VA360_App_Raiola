import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Single self-contained server for the Docker image (Coolify).
  output: "standalone",
  // Native module and document parsers: keep them out of the bundle and load them from node_modules.
  serverExternalPackages: ["better-sqlite3", "unpdf", "mammoth"],
  poweredByHeader: false,
};

export default nextConfig;
