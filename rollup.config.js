import json from "rollup-plugin-json";
import resolve from "@rollup/plugin-node-resolve";
import { terser } from "rollup-plugin-terser";
import replace from "@rollup/plugin-replace";

export default [
  {
    input: "src/index.js",
    plugins: [
      replace({
        _DEBUG_: true
      }),
      json({ exclude: ["node_modules/**"] })
    ],
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
      },
      {
        format: "umd",
        name: "ECSY",
        noConflict: true,
        file: "site/build/ecsy.js",
        indent: "\t"
      },
      {
        format: "es",
        file: "site/build/ecsy.module.js",
        indent: "\t"
      }
    ]
  },
  {
    input: "src/index.js",
    plugins: [
      replace({
        _DEBUG_: false
      }),
      json({ exclude: ["node_modules/**"] }),
      terser()
    ],
    output: [
      {
        format: "umd",
        name: "ECSY",
        noConflict: true,
        file: "build/ecsy.min.js",
        indent: "\t",
        sourcemap: true
      },
      {
        format: "es",
        file: "build/ecsy.module.min.js",
        indent: "\t",
        sourcemap: true
      },
      {
        format: "umd",
        name: "ECSY",
        noConflict: true,
        file: "site/build/ecsy.min.js",
        indent: "\t",
        sourcemap: true
      },
      {
        format: "es",
        file: "site/build/ecsy.module.min.js",
        indent: "\t",
        sourcemap: true
      }
    ]
  },
  {
    input: "benchmarks/browser.js",
    plugins: [json(), resolve()],
    output: [
      {
        format: "es",
        file: "site/benchmarks/benchmarks.module.js",
        indent: "\t"
      }
    ]
  }
];
