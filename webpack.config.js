const path = require('path');

module.exports = {
  mode: 'none',
  target: 'node',
  entry: {
    extension: './src/extension.ts',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    libraryTarget: 'commonjs',
  },
  resolve: {
    mainFields: ['module', 'main'],
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              compilerOptions: {
                module: 'es6',
              },
            },
          },
        ],
      },
    ],
  },
  externals: {
    vscode: 'commonjs vscode',
    debug: 'commonjs debug',
  },
  devtool: 'nosources-source-map',
};
