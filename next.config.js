/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@react-pdf/renderer", "mongoose", "bcryptjs", "pdf-parse"],
  outputFileTracingIncludes: {
    "/api/invoices/\\[id\\]/pdf": [
      "./node_modules/@react-pdf/**/*",
      "./node_modules/@pdf-lib/**/*",
      "./node_modules/fontkit/**/*",
      "./node_modules/pdfkit/**/*",
    ],
  },
};

module.exports = nextConfig;
