const path = require('path');
// const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
// const CopyWebpackPlugin = require('copy-webpack-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

const mode = 'development'

module.exports = env => ({
  mode,
  devtool: 'inline-source-map',
  entry: {
    bundle: './examples/index.ts',
    canvas: './examples/ecs-canvas/index.ts',
  },
  output: {
    filename: '[name].js',
    chunkFilename: 'scripts/[name].js',
    path: path.resolve(__dirname, 'dist'),
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
          // {
          //   loader: MiniCssExtractPlugin.loader,
          //   options: {
          //     reloadAll: true,
          //   },
          // },
          {
            loader: "css-loader",
            options: { sourceMap: true },
          },

          {
            loader: "sass-loader",
            options: {
              sourceMap: true,
              // includePaths: [
              //   path.resolve(__dirname, 'src/fonts/'),
              //   path.resolve(__dirname, 'src/styles/'),
              //   path.resolve(__dirname, 'src/ssr/components/'),
              // ],
            },
          },
        ],
      },
      // {
      //   test: /\.(mov|mp4|png|svg|jpg|gif)$/,
      //   use: [{
      //     loader: 'file-loader',
      //     options: {
      //       outputPath: 'assets',
      //       name: '[name].[ext]',
      //       useRelativePath: true,
      //     },
      //   }]
      // },
      // {
      //   test: /\.(woff|woff2|eot|ttf|otf)$/,
      //   use: [{
      //     loader: 'file-loader',
      //     options: {
      //       outputPath: 'fonts',
      //       name: '[name].[ext]',
      //     },
      //   }]
      // },

    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    // alias: {
    //   fonts: path.resolve(__dirname, 'src/fonts/'),
    //   images: path.resolve(__dirname, 'src/images/'),
    //   styles: path.resolve(__dirname, 'src/styles/'),
    //   templates: path.resolve(__dirname, 'src/ssr/templates/'),
    //   components: path.resolve(__dirname, 'src/ssr/components/'),
    // },
    plugins: [
      new TsconfigPathsPlugin({
        configFile: "./tsconfig.json",
      }),
    ],
  },
  plugins: [
    // new CopyWebpackPlugin([
    //   { from: 'src/assets', to: 'assets' }
    // ]),
    // new MiniCssExtractPlugin({
    //   filename: "[name].css",
    //   chunkFilename: "[id].css"
    // }),
    new CleanWebpackPlugin(),
    new HtmlWebpackPlugin({
      // chunks: ['canvas'],
      filename: 'ecs-canvas.html',
      template: './examples/ecs-canvas/index.html',
    }),
    new HtmlWebpackPlugin({
      // chunks: ['bundle'],
      template: './examples/index.html',
    }),

  ],
  optimization: {
    splitChunks: {
      cacheGroups: {
        commons: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all'
        }
      }
    }
  },
});
