/** @type {import('next').NextConfig} */
const nextConfig = {
  // contracts là gói trong workspace, cần Next.js biên dịch cùng mã web.
  transpilePackages: ["@movie/contracts"],
};

export default nextConfig;
