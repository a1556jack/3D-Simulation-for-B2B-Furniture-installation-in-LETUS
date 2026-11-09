import type { NextConfig } from 'next';
const nextConfig: NextConfig = { output: 'export', allowedDevOrigins: ['127.0.0.1'], basePath: process.env.NEXT_PUBLIC_BASE_PATH || '', images: { unoptimized: true } };
export default nextConfig;
