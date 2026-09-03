const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = [
  "react-native",
  "browser",
  "require",
  "import",
];

const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolve
    ? defaultResolve.bind(config.resolver)
    : context.resolveRequest.bind(context);
  try {
    return resolve(context, moduleName, platform);
  } catch (error) {
    if (moduleName.endsWith(".js")) {
      try {
        return resolve(context, moduleName.replace(/\.js$/, ".ts"), platform);
      } catch {
        return resolve(context, moduleName.replace(/\.js$/, ".tsx"), platform);
      }
    }
    throw error;
  }
};

module.exports = config;
