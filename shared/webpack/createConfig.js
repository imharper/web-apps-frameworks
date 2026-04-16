const path = require("node:path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const Dotenv = require("dotenv-webpack");
const { container } = require("webpack");

const { ModuleFederationPlugin } = container;

const repoRoot = path.resolve(__dirname, "../..");

function sharedDependencies(packageJson) {
  const deps = packageJson.dependencies || {};
  const shared = {
    react: {
      singleton: true,
      requiredVersion: deps.react,
    },
    "react-dom": {
      singleton: true,
      requiredVersion: deps["react-dom"],
    },
    "@ticket-cabinet/shared": {
      singleton: true,
      requiredVersion: deps["@ticket-cabinet/shared"],
    },
    "@reduxjs/toolkit": deps["@reduxjs/toolkit"]
      ? {
          singleton: true,
          requiredVersion: deps["@reduxjs/toolkit"],
        }
      : undefined,
    "react-redux": deps["react-redux"]
      ? {
          singleton: true,
          requiredVersion: deps["react-redux"],
        }
      : undefined,
    mobx: deps.mobx
      ? {
          singleton: true,
          requiredVersion: deps.mobx,
        }
      : undefined,
    "mobx-react-lite": deps["mobx-react-lite"]
      ? {
          singleton: true,
          requiredVersion: deps["mobx-react-lite"],
        }
      : undefined,
  };

  return Object.fromEntries(Object.entries(shared).filter(([, value]) => Boolean(value)));
}

function createConfig({
  appDir,
  mode,
  port,
  packageJson,
  federation,
  remotes = {},
}) {
  const isDev = mode === "development";

  return {
    mode,
    entry: path.resolve(appDir, "src/index.ts"),
    output: {
      path: path.resolve(appDir, "dist"),
      filename: isDev ? "[name].js" : "[name].[contenthash].js",
      chunkFilename: isDev ? "[name].chunk.js" : "[name].[contenthash].chunk.js",
      clean: true,
      publicPath: "auto",
    },
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
      alias: {
        "@shared": path.resolve(repoRoot, "shared/src/index.ts"),
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: {
            loader: "ts-loader",
            options: {
              configFile: path.resolve(appDir, "tsconfig.json"),
            },
          },
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
        },
      ],
    },
    plugins: [
      new Dotenv({
        path: path.resolve(repoRoot, ".env"),
        systemvars: true,
        silent: true,
      }),
      new HtmlWebpackPlugin({
        template: path.resolve(appDir, "index.html"),
      }),
      new ModuleFederationPlugin({
        name: federation.name,
        filename: federation.filename || "remoteEntry.js",
        exposes: federation.exposes,
        remotes,
        shared: sharedDependencies(packageJson),
      }),
    ],
    devServer: {
      port,
      historyApiFallback: true,
      hot: true,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      static: {
        directory: path.resolve(appDir, "dist"),
      },
    },
  };
}

module.exports = {
  createConfig,
};
