const Handlebars = require("handlebars");

Handlebars.registerHelper("ifNoKind", function(options) {
  if (!this.kindString) {
    return options.fn(this);
  }
});

const MarkdownTheme = require("typedoc-plugin-markdown/dist/theme").default;
class CustomMarkdownTheme extends MarkdownTheme {
  constructor(renderer, basePath) {
    super(renderer, basePath);
  }
}
exports.default = CustomMarkdownTheme;
