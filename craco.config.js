/**
 * CRACO overrides to mitigate OOM during build
 * - Drop memory-heavy plugins (ForkTsChecker, ESLint, ReactRefresh) in all envs
 * - Disable source maps by default (can be re-enabled via env if needed)
 * - Ignore Moment.js locales to reduce bundle size
 */

const webpack = require('webpack');
module.exports = {
  webpack: {
    configure: (webpackConfig, { env }) => {
      // Ensure resolve.alias exists
      webpackConfig.resolve = webpackConfig.resolve || {};
      // Do not override React resolution; use CRA defaults
      webpackConfig.resolve.alias = {
        ...(webpackConfig.resolve.alias || {}),
      };
      if (Array.isArray(webpackConfig.plugins)) {
        const drop = new Set([
          'ForkTsCheckerWebpackPlugin',
          'ForkTsCheckerWarningWebpackPlugin',
          'ReactRefreshWebpackPlugin',
          'ESLintWebpackPlugin',
        ]);
        webpackConfig.plugins = webpackConfig.plugins.filter((p) => {
          const name = p && p.constructor && p.constructor.name;
          return !drop.has(name);
        });

        // Ignore Moment locales to cut memory & bundle size
        webpackConfig.plugins.push(
          new webpack.IgnorePlugin({ resourceRegExp: /^\.\/locale$/, contextRegExp: /moment$/ })
        );
      }

      // Disable source maps unless explicitly enabled
      if (!process.env.GENERATE_SOURCEMAP || process.env.GENERATE_SOURCEMAP === 'false') {
        webpackConfig.devtool = false;
      }

      return webpackConfig;
    },
  },
};
