const { createConfig } = require("../shared/webpack/createConfig");
const packageJson = require("./package.json");

module.exports = createConfig({
  appDir: __dirname,
  mode: "production",
  port: Number(process.env.FRONTEND_HOST_PORT || 3000),
  packageJson,
  remotes: {
    reduxApp: `reduxApp@${process.env.REDUX_REMOTE_URL || "http://localhost:8083"}/remoteEntry.js`,
    mobxApp: `mobxApp@${process.env.MOBX_REMOTE_URL || "http://localhost:8084"}/remoteEntry.js`,
  },
  federation: {
    name: "hostApp",
    filename: "remoteEntry.js",
    exposes: {},
  },
});
