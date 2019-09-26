import json from "rollup-plugin-json";
import { terser } from "rollup-plugin-terser";

export default [
  {
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
  },
  {
    input: "src/index.js",
    plugins: [json({ exclude: ["node_modules/**"] }), terser()],
    output: [
      {
        format: "umd",
        name: "ECSY",
        noConflict: true,
        file: "build/ecsy.min.js",
        indent: "\t"
      }
    ]
  }
];
