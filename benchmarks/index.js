import { Benchmarks } from "benchmarker-js";
import { init as initEntities } from "./entities.bench.js";

let benchmarks = new Benchmarks({
  verbose: true
});

initEntities(benchmarks);

benchmarks.run();
