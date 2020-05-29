import { Benchmarks } from "benchmarker-js";
import { init as initEntities } from "./entities.bench.js";
import { init as initWorld } from "./world.bench.js";
import { init as initPool } from "./objectpool.bench.js";
import { init as initComponents } from "./components.bench.js";

let benchmarks = new Benchmarks({
  // verbose: true,
  summary: true
});

initWorld(benchmarks);
initEntities(benchmarks);
initPool(benchmarks);
//initComponents(benchmarks);
benchmarks.run();
