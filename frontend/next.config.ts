import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  webpack: (config, { isServer, webpack }) => {
    // Ignore canvas module completely using webpack's IgnorePlugin
    // This prevents webpack from trying to bundle the Node.js-only canvas package
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^canvas$/,
      })
    );

    // Set fallback for canvas on both server and client
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
    };

    // Also add alias to prevent resolution
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };

    return config;
  },
};

export default nextConfig;
