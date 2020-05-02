const path = require('path');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

const mode = 'development'

const configs = {
  examples: 'examples',
  canvas: 'examples/canvas',
  'circles-boxes': 'examples/circles-boxes',
  'babylon': 'examples/ball-example/babylon',
  'three': 'examples/ball-example/three',
  'factory': 'examples/factory',
  'system-state-components': 'examples/system-state-components',
  'attraction-and-repulsion': 'examples/three-pix-droid/attraction-and-repulsion',
}

const projects = {
  entry: Object.entries(configs).reduce((accumulator, [key, value]) => {
    accumulator[key] = `./${value}/index.ts`;

    return accumulator;
  }, {}),
  htmlWebpackPlugins: Object.entries(configs).reduce((accumulator, [key, value]) => {

    const htmlWebpackPlugin = new HtmlWebpackPlugin({
      template: `./${value}/index.html`,
      inject: true,
      chunks: [key],
      filename: `./${value}/index.html`,
    })

    accumulator.push(htmlWebpackPlugin);

    return accumulator;
  }, []),
}

module.exports = (env) => ({
  mode,
  devtool: 'inline-source-map',
  entry: projects.entry,
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    chunkFilename: 'scripts/[name].js',
  },
  devServer: {
    contentBase: path.join(__dirname, 'dist'),
    compress: true,
    port: 8080,
    host: '0.0.0.0',
  },
  module: {
    rules: [
      {
        test: /\.html$/,
        use: [{
          loader: 'html-loader',
        }]
      },
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.scss$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
          },
          {
            loader: "css-loader",
            options: { sourceMap: true },
          },

          {
            loader: "sass-loader",
            options: {
              sourceMap: true,
            },
          },
        ],
      },
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    plugins: [
      new TsconfigPathsPlugin({
        configFile: "./tsconfig.app.json",
      }),
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: '[name].css',
      chunkFilename: '[id].css',
    }),
    // new CleanWebpackPlugin(),
    new HtmlWebpackPlugin({
      template: './index.html',
      filename: './index.html',
    }),
    ...projects.htmlWebpackPlugins,
  ],
});
