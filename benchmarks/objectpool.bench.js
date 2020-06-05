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
    })
    .add({
      name: "acquiring 100k. ObjectPool(Component1, 100k)",
      prepare: ctx => {
        ctx.pool = new ObjectPool(Component3, 100000);
      },
      execute: ctx => {
        for (let i = 0; i < 100000; i++) {
          ctx.pool.acquire();
        }
      }
    })
    .add({
      name: "acquiring 100k. ObjectPool(Component1)",
      prepare: ctx => {
        ctx.pool = new ObjectPool(Component3);
      },
      execute: ctx => {
        for (let i = 0; i < 100000; i++) {
          ctx.pool.acquire();
        }
      }
    })
    .add({
      name: "returning 100k. ObjectPool(Component1)",
      prepare: ctx => {
        ctx.pool = new ObjectPool(Component3);
        ctx.components = [];
        for (let i = 0; i < 100000; i++) {
          ctx.components.push(ctx.pool.acquire());
        }
      },
      execute: ctx => {
        for (let i = 0; i < 100000; i++) {
          ctx.pool.release(ctx.components[i]);
        }
      }
    });
}
