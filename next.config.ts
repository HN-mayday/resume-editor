import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The editor has no server-side data dependency, so export it as a static
  // site for GitHub Pages while retaining the same local editing experience.
  output: process.env.GITHUB_ACTIONS ? "export" : undefined,
  trailingSlash: true,
  basePath: process.env.GITHUB_ACTIONS ? "/resume-editor" : "",
};

export default nextConfig;
