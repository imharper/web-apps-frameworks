const { createConfig } = require("../shared/webpack/createConfig");
const packageJson = require("./package.json");

module.exports = createConfig({
  appDir: __dirname,
  mode: "production",
  port: Number(process.env.FRONTEND_PORT || 3001),
  packageJson,
  federation: {
    name: "reduxApp",
    filename: "remoteEntry.js",
    exposes: {
      "./RemoteDashboard": "./src/RemoteDashboard.tsx",
    },
  },
});
