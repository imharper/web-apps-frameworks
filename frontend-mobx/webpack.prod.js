const { createConfig } = require("../shared/webpack/createConfig");
const packageJson = require("./package.json");

module.exports = createConfig({
  appDir: __dirname,
  mode: "production",
  port: Number(process.env.FRONTEND_MOBX_PORT || 3002),
  packageJson,
  federation: {
    name: "mobxApp",
    filename: "remoteEntry.js",
    exposes: {
      "./RemoteDashboard": "./src/RemoteDashboard.tsx",
    },
  },
});
