const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const path = require('path');
const fs = require('fs');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

// Load root .env for port configuration
// - Local development: ../.env (relative to web-ui folder)
// - Docker development: ./.env (mounted via docker-compose volume)
const localEnvPath = path.resolve(__dirname, '../.env');
const dockerEnvPath = path.resolve(__dirname, './.env');
const envPath = fs.existsSync(localEnvPath) ? localEnvPath : dockerEnvPath;
require('dotenv').config({ path: envPath });

const { properties } = require('./config.schema.json');
const pkgFile = require('./package.json');

// Port configuration from root .env (with defaults matching .env.example)
const API_PORT = process.env.API_PORT || 4000;
const WEB_UI_PORT = process.env.WEB_UI_PORT || 8080;

// Set stacFinderApiUrl if not already set by environment
if (!process.env.SB_stacFinderApiUrl) {
  process.env.SB_stacFinderApiUrl = `http://localhost:${API_PORT}`;
}

const optionsForType = (type) => Object.entries(properties)
  .filter(([_, schema]) => Array.isArray(schema.type) && schema.type.includes(type))
  .map(([key]) => key);
const argv = yargs(hideBin(process.argv))
  .parserConfiguration({'camel-case-expansion': false})
  .env('SB')
  .boolean(optionsForType("boolean"))
  .number(optionsForType("number").concat(optionsForType("integer")))
  .array(optionsForType("array"))
  .option(
    Object.fromEntries(
      optionsForType("object").map((k) => [k, { coerce: JSON.parse }])
    )
  )
  .argv;
// Clean-up arguments
delete argv._;
delete argv.$0;

const configFile = path.resolve(argv.CONFIG ? argv.CONFIG : './config.js');
const configFromFile = require(configFile);
const mergedConfig = Object.assign(configFromFile, argv);

const vueConfig = {
  lintOnSave: process.env.NODE_ENV !== 'production',
  productionSourceMap: !mergedConfig.noSourceMaps,
  publicPath: mergedConfig.pathPrefix,

  // Required for Docker development: bind to 0.0.0.0 so container is accessible from host
  devServer: {
    host: '0.0.0.0',
    port: WEB_UI_PORT
  },

  chainWebpack: webpackConfig => {
    webpackConfig.plugin('define').tap(args => {
      args[0].STAC_BROWSER_VERSION = JSON.stringify(pkgFile.version);
      args[0].CONFIG_PATH = JSON.stringify(configFile);
      args[0].CONFIG_CLI = JSON.stringify(argv);
      return args;
    });

    webpackConfig.plugin('html').tap(args => {
      args[0].title = mergedConfig.catalogTitle;
      args[0].url = mergedConfig.catalogUrl;
      return args;
    });
  },
  configureWebpack: {
    resolve: {
      fallback: {
        'fs/promises': false
      }
    },
    plugins: [
      new NodePolyfillPlugin({
        includeAliases: ['Buffer', 'path']
      })
    ]
  },
  pluginOptions: {
    i18n: {
      locale: mergedConfig.locale,
      fallbackLocale: mergedConfig.fallbackLocale,
      enableInSFC: false
    }
  }
};

module.exports = vueConfig;
