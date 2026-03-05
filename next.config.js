/** @type {import('next').NextConfig} */
const webpack = require('webpack');

module.exports = {
  reactStrictMode: true,
  basePath: '/demo',
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
    config.plugins.push(
      new webpack.DefinePlugin({
        __VERSION__: JSON.stringify(require('./package.json').version),
      })
    );
    return config;
  },
};
