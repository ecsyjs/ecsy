import { Benchmarks } from "benchmarker-js";
import { init as initEntities } from "./entities.bench.js";
import { init as initWorld } from "./world.bench.js";
<<<<<<< HEAD
import { init as initPool } from "./objectpool.bench.js";
import { init as initComponents } from "./components.bench.js";

import fs from "fs";
=======
>>>>>>> More benchmarks

let benchmarks = new Benchmarks({
  //  verbose: true,
  summary: true,
  iterations: 10
});

initWorld(benchmarks);
initEntities(benchmarks);
initPool(benchmarks);
initComponents(benchmarks);
benchmarks.run();

console.log(JSON.stringify(benchmarks.getReport("json"), null, "\t"));
fs.writeFile(
  "benchmark_result.json",
  JSON.stringify(benchmarks.getReport("json"), null, "\t"),
  err => {
    if (err) console.log(err);
  }
);
