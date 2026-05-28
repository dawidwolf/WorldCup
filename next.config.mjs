/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['192.168.137.1', '192.168.100.10', 'localhost:3000', '0.0.0.0:3000', '192.168.137.1:3000', '192.168.100.10:3000', '192.168.137.1:3005', '192.168.100.10:3005', 'localhost:3005', '0.0.0.0:3005'],
}

export default nextConfig
