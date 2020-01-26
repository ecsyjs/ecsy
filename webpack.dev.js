const path = require('path');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

const mode = 'development'

module.exports = (env) => ({
  mode,
  devtool: 'inline-source-map',
  entry: {
    examples: './examples/index.ts',
    canvas: './examples/canvas/index.ts',
    'circles-boxes': './examples/circles-boxes/index.ts',
    'babylon': './examples/ball-example/babylon/index.ts',
    'three': './examples/ball-example/three/index.ts',
    'factory': './examples/factory/index.ts',
    'system-state-components': './examples/system-state-components/index.ts',
  },
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
    new CleanWebpackPlugin(),
    new HtmlWebpackPlugin({
      template: './index.html',
      filename: './index.html',
    }),
    new HtmlWebpackPlugin({
      template: './examples/index.html',
      inject: true,
      chunks: ['examples'],
      filename: './examples/index.html',
    }),
    new HtmlWebpackPlugin({
      template: './examples/circles-boxes/index.html',
      inject: true,
      chunks: ['circles-boxes'],
      filename: './circles-boxes/index.html',
    }),
    new HtmlWebpackPlugin({
      template: './examples/canvas/index.html',
      inject: true,
      chunks: ['canvas'],
      filename: './canvas/index.html',
    }),
    new HtmlWebpackPlugin({
      template: './examples/ball-example/babylon/index.html',
      inject: true,
      chunks: ['babylon'],
      filename: './ball-example/babylon/index.html',
    }),
    new HtmlWebpackPlugin({
      template: './examples/ball-example/three/index.html',
      inject: true,
      chunks: ['three'],
      filename: './ball-example/three/index.html',
    }),
    new HtmlWebpackPlugin({
      template: './examples/factory/index.html',
      inject: true,
      chunks: ['factory'],
      filename: './factory/index.html',
    }),
    new HtmlWebpackPlugin({
      template: './examples/system-state-components/index.html',
      inject: true,
      chunks: ['system-state-components'],
      filename: './system-state-components/index.html',
    }),
  ],
});
