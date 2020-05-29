import ObjectPool from "../src/ObjectPool.js";
import { TagComponentA, Component3 } from "./helpers/components.js";

export function init(benchmarks) {
  benchmarks
    .add({
      name: "new ObjectPool(TagComponent, 100k)",
      execute: () => {
        new ObjectPool(TagComponentA, 100000);
      },
      iterations: 20
    })
    .add({
      name: "new ObjectPool(Component1, 100k)",
      execute: () => {
        new ObjectPool(Component3, 100000);
      },
      iterations: 20
    });
}
