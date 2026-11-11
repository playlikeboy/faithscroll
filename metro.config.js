// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Drizzle migrations are imported as inline SQL strings.
config.resolver.sourceExts.push('sql');
// The bundled read-only Bible database ships as an asset.
config.resolver.assetExts.push('db');

module.exports = config;
