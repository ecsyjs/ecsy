import json from "rollup-plugin-json";

export default {
  input: "src/index.js",
  plugins: [json({ exclude: ["node_modules/**"] })],
  output: [
    {
      format: "umd",
      name: "ECSY",
      noConflict: true,
      file: "build/ecsy.js",
      indent: "\t"
    },
    {
      format: "es",
      file: "build/ecsy.module.js",
      indent: "\t"
    }
  ]
};
