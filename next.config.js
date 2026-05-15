/** @type {import('next').NextConfig} */
const webpack = require('webpack');

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/map-demo';

module.exports = {
  reactStrictMode: true,
  basePath: basePath,
  output: 'export',
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
    config.plugins.push(
      new webpack.DefinePlugin({
        __VERSION__: JSON.stringify(require('./package.json').version),
        __BASE_PATH__: JSON.stringify(basePath),
      })
    );
    return config;
  },
};
