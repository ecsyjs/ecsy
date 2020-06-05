import { World } from "../src";
import {
  TagComponentA,
  TagComponentB,
  TagComponentC
} from "./helpers/components.js";

export function init(benchmarks) {
  benchmarks
    // TAG COMPONENTS
    .add({
      name: "Add 1 tagComponent",
      prepare: ctx => {
        ctx.world = new World({ entityPoolSize: 100 });
        ctx.world.registerComponent(TagComponentA);
        for (let i = 0; i < 100000; i++) {
          ctx.world.createEntity();
        }
      },
      execute: ctx => {
        for (let i = 0; i < 100000; i++) {
          ctx.world.entityManager._entities[i].addComponent(TagComponentA);
        }
      },
      iterations: 10
    })
    .add({
      name: "Add 2 tagComponent",
      prepare: ctx => {
        ctx.world = new World({ entityPoolSize: 100 });
        ctx.world
          .registerComponent(TagComponentA)
          .registerComponent(TagComponentB);
        for (let i = 0; i < 100000; i++) {
          ctx.world.createEntity();
        }
      },
      execute: ctx => {
        for (let i = 0; i < 100000; i++) {
          ctx.world.entityManager._entities[i]
            .addComponent(TagComponentA)
            .addComponent(TagComponentB);
        }
      },
      iterations: 10
    })
    .add({
      name: "Add 3 tagComponent",
      prepare: ctx => {
        ctx.world = new World({ entityPoolSize: 100 });
        ctx.world
          .registerComponent(TagComponentA)
          .registerComponent(TagComponentB)
          .registerComponent(TagComponentC);
        for (let i = 0; i < 100000; i++) {
          ctx.world.createEntity();
        }
      },
      execute: ctx => {
        for (let i = 0; i < 100000; i++) {
          ctx.world.entityManager._entities[i]
            .addComponent(TagComponentA)
            .addComponent(TagComponentB)
            .addComponent(TagComponentC);
        }
      },
      iterations: 10
    })
    .add({
      name: "Remove 1 tagComponent (100k entities with 1 component)",
      prepare: ctx => {
        ctx.world = new World({ entityPoolSize: 100 });
        ctx.world.registerComponent(TagComponentA);
        for (let i = 0; i < 100000; i++) {
          ctx.world.createEntity().addComponent(TagComponentA);
        }
      },
      execute: ctx => {
        for (let i = 0; i < 100000; i++) {
          ctx.world.entityManager._entities[i].removeComponent(TagComponentA);
        }
      },
      iterations: 10
    })
    .add({
      name: "Remove 1 tagComponent (100k entities with 3 component)",
      prepare: ctx => {
        ctx.world = new World({ entityPoolSize: 100 });
        ctx.world
          .registerComponent(TagComponentA)
          .registerComponent(TagComponentB)
          .registerComponent(TagComponentC);
        for (let i = 0; i < 100000; i++) {
          ctx.world
            .createEntity()
            .addComponent(TagComponentA)
            .addComponent(TagComponentB)
            .addComponent(TagComponentC);
        }
      },
      execute: ctx => {
        for (let i = 0; i < 100000; i++) {
          ctx.world.entityManager._entities[i].removeComponent(TagComponentA);
        }
      },
      iterations: 10
    });
}
