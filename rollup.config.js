import typescript from "@rollup/plugin-typescript";
import json from "rollup-plugin-json";
import { terser } from "rollup-plugin-terser";

export default [
  {
    input: "src/index.ts",
    output: [
      {
        format: "umd",
        name: "ECSY",
        noConflict: true,
        file: "build/ecsy.js",
        indent: "\t",
        sourcemap: true,
      },
      {
        format: "es",
        file: "build/ecsy.module.js",
        indent: "\t",
        sourcemap: true,
      },
      {
        format: "umd",
        name: "ECSY",
        noConflict: true,
        file: "build/ecsy.min.js",
        indent: "\t",
        sourcemap: true,
        plugins: [
          terser(),
        ],
      },
    ],
    plugins: [
      typescript(),
      json({ exclude: ["node_modules/**"] }),
    ],
  },
];
