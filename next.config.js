/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@react-pdf/renderer", "mongoose", "bcryptjs"],
};

module.exports = nextConfig;
