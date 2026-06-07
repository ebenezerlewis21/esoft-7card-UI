const { expo: appJson } = require("./app.json");

module.exports = ({ config }) => {
  const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "local";
  const envSuffixByName = {
    local: "Local",
    development: "Dev",
    test: "Test",
    production: "",
  };
  const envSuffixBySlug = {
    local: "-local",
    development: "-dev",
    test: "-test",
    production: "",
  };

  const nameSuffix = envSuffixByName[appEnv] ?? "Dev";
  const slugSuffix = envSuffixBySlug[appEnv] ?? "-dev";
  const baseName = (appJson?.name || "my-app").trim();
  const baseSlug = (appJson?.slug || "my-app").trim();

  const expoConfig = {
    ...(appJson ?? {}),
    ...(config ?? {}),
    name: nameSuffix ? `${baseName} ${nameSuffix}` : baseName,
    slug: `${baseSlug}${slugSuffix}`,
    extra: {
      ...(appJson?.extra ?? {}),
      ...(config?.extra ?? {}),
      appEnv,
    },
  };

  if (!expoConfig.scheme) {
    expoConfig.scheme = appJson?.scheme ?? "myapp";
  }

  return {
    expo: expoConfig,
  };
};
