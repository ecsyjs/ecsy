import { Benchmarks } from "benchmarker-js";
import { init as initEntities } from "./entities.bench.js";
import { init as initWorld } from "./world.bench.js";

let benchmarks = new Benchmarks({
  verbose: true
});

initWorld(benchmarks);
initEntities(benchmarks);

benchmarks.run();
