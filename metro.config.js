// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Drizzle migrations are imported as inline SQL strings.
config.resolver.sourceExts.push('sql');
// The bundled read-only Bible database ships as an asset.
config.resolver.assetExts.push('db');

// expo-sqlite on web runs SQLite as WebAssembly in a worker (dev preview only; iOS/Android are the targets).
config.resolver.assetExts.push('wasm');

// SQLite's web worker needs SharedArrayBuffer, which requires a cross-origin-isolated page.
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  return middleware(req, res, next);
};

module.exports = config;
