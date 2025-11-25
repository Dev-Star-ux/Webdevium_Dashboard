import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* Performance optimizations */
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // Optimize production builds
  swcMinify: true,
  // Compress responses
  compress: true,
  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // Reduce bundle size
  productionBrowserSourceMaps: false,
  // Configure webpack to handle Windows file locks better
  webpack: (config, { dev }) => {
    // Handle Windows file lock issues with webpack pack file cache
    if (dev && process.platform === 'win32') {
      // Use filesystem cache without compression on Windows to avoid EBUSY errors
      // This prevents file rename operations that cause locks
      config.cache = {
        type: 'filesystem',
        // Don't compress cache files to avoid rename/lock issues
        compression: false,
        // Don't use buildDependencies to avoid path resolution issues
      }
    }
    return config
  },
}

export default nextConfig
