import { World } from "../src";

export function init(benchmarks) {
  let world = new World();
  benchmarks
    .add({
      name: "World(entityPoolSize: 100k))",
      execute: () => {
        let world = new World({ entityPoolSize: 100000 });
      },
      iterations: 10
    })
    .add({
      name: "World.createEntity (100k empty, recreating world)",
      execute: () => {
        let world = new World();
        for (let i = 0; i < 100000; i++) {
          world.createEntity();
        }
      },
      iterations: 10
    })
    .add({
      name: "World.createEntity (100k empty, recreating world (poolSize: 100k))",
      execute: () => {
        let world = new World({entityPoolSize: 100000});
        for (let i = 0; i < 100000; i++) {
          world.createEntity();
        }
      },
      iterations: 10
    })
    .add({
      name: "World.createEntity (100k empty, recreate world, entityPoolSize = 100k)",
      prepare: ctx => {
        ctx.world = new World({ entityPoolSize: 100000 });
      },
      execute: ctx => {
        for (let i = 0; i < 100000; i++) {
          ctx.world.createEntity();
        }
      },
      iterations: 10
    })
    .add({
      name: "World.createEntity (100k empty, resue world, entityPoolSize = 100k * 10)",
      prepareGlobal: ctx => {
        ctx.world = new World({ entityPoolSize: 100000 * 10 });
      },
      execute: ctx => {
        for (let i = 0; i < 100000; i++) {
          ctx.world.createEntity();
        }
      },
      iterations: 10
    });
}
