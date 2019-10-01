const Handlebars = require("handlebars");

const MarkdownTheme = require("typedoc-plugin-markdown/dist/theme").default;
class CustomMarkdownTheme extends MarkdownTheme {
  constructor(renderer, basePath) {
    super(renderer, basePath);
  }
}
exports.default = CustomMarkdownTheme;
