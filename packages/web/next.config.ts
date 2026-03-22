import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";
import type { NextConfig } from "next";

export default (phase: string): NextConfig => {
  const config: NextConfig = {
    distDir: "out",
  };

  if (phase === PHASE_DEVELOPMENT_SERVER) {
    config.rewrites = async () => [
      { source: "/api/:path*", destination: "http://127.0.0.1:7777/api/:path*" },
      { source: "/ws", destination: "http://127.0.0.1:7777/ws" },
    ];
  } else {
    config.output = "export";
  }

  return config;
};
