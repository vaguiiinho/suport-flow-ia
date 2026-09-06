/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    useTypeScriptCli: false
  }
};

export default nextConfig;
