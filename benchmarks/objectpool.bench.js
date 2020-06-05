import { ObjectPool } from "../src/ObjectPool.js";
import { TagComponentA, Component3 } from "./helpers/components.js";

export function init(benchmarks) {
  benchmarks
    .group("objectpool")
    .add({
      name: "new ObjectPool(TagComponent, 100k)",
      execute: () => {
        new ObjectPool(new TagComponentA(), 100000);
      }
    })
    .add({
      name: "new ObjectPool(Component1, 100k)",
      execute: () => {
        new ObjectPool(new Component3(), 100000);
      }
    });
}
