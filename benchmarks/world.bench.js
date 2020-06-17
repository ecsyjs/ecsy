import { World } from "../src/World.js";

export function init(benchmarks) {
  benchmarks
    .group("world")
    .add({
      name: "new World({ entityPoolSize: 100k })",
      execute: () => {
        new World({ entityPoolSize: 100000 });
      },
      iterations: 10
    })
    .add({
      name: "World::createEntity (100k empty, recreating world)",
      execute: () => {
        let world = new World();
        for (let i = 0; i < 100000; i++) {
          world.createEntity();
        }
      },
      iterations: 10
    })
    .add({
      name:
        "World::createEntity (100k empty, recreating world (poolSize: 100k))",
      execute: () => {
        let world = new World({ entityPoolSize: 100000 });
        for (let i = 0; i < 100000; i++) {
          world.createEntity();
        }
      },
      iterations: 10
    })
    .add({
      name:
        "World::createEntity (100k empty, recreating world (not measured), entityPoolSize = 100k)",
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
      name:
        "World::createEntity(name) (100k empty, recreating world (not measured), entityPoolSize = 100k)",
      prepare: ctx => {
        ctx.world = new World({ entityPoolSize: 100000 });
      },
      execute: ctx => {
        for (let i = 0; i < 100000; i++) {
          ctx.world.createEntity("name" + i);
        }
      },
      iterations: 10
    })
    .add({
      name:
        "World::createEntity (100k empty, reuse world, entityPoolSize = 100k * 10)",
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
