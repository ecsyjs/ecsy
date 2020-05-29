import ObjectPool from "../src/ObjectPool.js";
import { TagComponentA } from "./helpers/components.js";

export function init(benchmarks) {
  benchmarks.add({
    name: "new ObjectPool(TagComponent, 100k)",
    execute: () => {
      new ObjectPool(TagComponentA, 100000);
    },
    iterations: 20
  });
}
