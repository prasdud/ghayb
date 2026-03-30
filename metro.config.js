const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.watchFolders = [
  path.resolve(__dirname, "packages/dragbin-native-crypto"),
  path.resolve(__dirname, "packages/dragbin-crypto"),
];

// On web, redirect @dragbin/native-crypto to the WASM-backed web implementation
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "@dragbin/native-crypto") {
    return {
      filePath: path.resolve(__dirname, "packages/dragbin-native-crypto/src/index.web.ts"),
      type: "sourceFile",
    };
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
