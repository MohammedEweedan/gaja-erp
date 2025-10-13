// React JS shim used by webpack alias in craco.config.js
// At runtime, bundler resolves 'react' -> this file, which re-exports the real package.
module.exports = require('react-original');
