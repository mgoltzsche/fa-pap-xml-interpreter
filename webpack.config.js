const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

module.exports = {
	entry: './src/index.js',
	output: {
		path: path.resolve(__dirname, 'dist'),
		filename: 'index_bundle.js'
	},
	devtool: 'source-map',
	module: {
		rules: [
			{
				test: /\.s[ac]ss$/,
					use: [
						'style-loader',
						'css-loader',
						'sass-loader',
					],
			},
			{
				test: /\.x(ht)?ml$/,
				use: [
					'raw-loader',
				],
			},
		],
	},
  plugins: [
    new HtmlWebpackPlugin({template: './src/index.html'}),
  ]
}
