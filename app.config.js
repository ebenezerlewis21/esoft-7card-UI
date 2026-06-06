const { expo: appJson } = require("./app.json");

module.exports = ({ config }) => {
  const expoConfig = {
    ...(appJson ?? {}),
    ...(config ?? {}),
  };

  if (!expoConfig.scheme) {
    expoConfig.scheme = appJson?.scheme ?? "myapp";
  }

  return {
    expo: expoConfig,
  };
};
